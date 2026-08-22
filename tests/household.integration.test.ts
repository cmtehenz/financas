import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { closeDb, getDb } from "@/db";
import { requireTestDatabaseUrl } from "@/lib/test-database";
import { householdInvitations, householdMembers, households } from "@/db/schema";
import { user } from "@/db/schema/auth";
import { SEED_CATEGORIES } from "@/domain/seed-categories";
import { ForbiddenError } from "@/lib/access";
import { hashInviteToken } from "@/lib/invite-token";
import { createFinancialAccount } from "@/services/accounts";
import {
  assertHouseholdAccessForUser,
  countHouseholdCategories,
  createHouseholdForUser,
  seedHouseholdCategories,
} from "@/services/households";
import {
  acceptHouseholdInvitation,
  createHouseholdInvitation,
  InvitationError,
  revokeHouseholdInvitation,
} from "@/services/invitations";

const canWrite = Boolean(process.env.TEST_DATABASE_URL);
if (canWrite) {
  requireTestDatabaseUrl();
}

const db = canWrite ? getDb() : null!;
const createdUserIds: string[] = [];
const createdHouseholdIds: string[] = [];

async function insertUser(name: string) {
  const id = crypto.randomUUID();
  const email = `vitest-${id}@example.test`;
  await db.insert(user).values({
    id,
    name,
    email,
    emailVerified: true,
  });
  createdUserIds.push(id);
  return { id, email, name };
}

describe.skipIf(!canWrite).sequential("household isolation", { timeout: 30_000 }, () => {
  afterAll(async () => {
    if (createdHouseholdIds.length > 0) {
      await db.delete(households).where(inArray(households.id, createdHouseholdIds));
    }

    if (createdUserIds.length > 0) {
      await db.delete(user).where(inArray(user.id, createdUserIds));
    }

    await closeDb();
  });

  it("creates a household, owner, seed categories and a cents-based account", async () => {
    const owner = await insertUser("Owner Test");
    const created = await createHouseholdForUser({
      userId: owner.id,
      name: "Casa Teste A",
    });
    createdHouseholdIds.push(created.household.id);

    expect(created.membership.role).toBe("OWNER");
    expect(created.household.createdByUserId).toBe(owner.id);
    expect(await countHouseholdCategories(created.household.id)).toBe(SEED_CATEGORIES.length);

    const again = await createHouseholdForUser({
      userId: owner.id,
      name: "Casa Teste A duplicada",
    });
    expect(again.household.id).toBe(created.household.id);

    expect(await seedHouseholdCategories(created.household.id)).toBe(SEED_CATEGORIES.length);

    const account = await createFinancialAccount({
      userId: owner.id,
      householdId: created.household.id,
      name: "Nubank",
      type: "CHECKING",
      openingBalanceCents: BigInt(150050),
      openingBalanceDate: "2026-08-22",
    });

    expect(account?.openingBalanceCents).toBe(BigInt(150050));
    expect(typeof account?.openingBalanceCents).toBe("bigint");
  });

  it("stores only the invite hash and enforces invitation rules", async () => {
    const owner = await insertUser("Owner Invite");
    const spouse = await insertUser("Spouse Invite");
    const stranger = await insertUser("Stranger Invite");
    const created = await createHouseholdForUser({
      userId: owner.id,
      name: "Casa Convite",
    });
    createdHouseholdIds.push(created.household.id);

    const invite = await createHouseholdInvitation({
      userId: owner.id,
      householdId: created.household.id,
      email: spouse.email,
    });

    const [stored] = await db
      .select()
      .from(householdInvitations)
      .where(eq(householdInvitations.householdId, created.household.id));

    expect(stored?.tokenHash).toBe(hashInviteToken(invite.token));
    expect(JSON.stringify(stored)).not.toContain(invite.token);

    await expect(
      createHouseholdInvitation({
        userId: spouse.id,
        householdId: created.household.id,
        email: "outro@example.test",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      acceptHouseholdInvitation({
        userId: stranger.id,
        email: stranger.email,
        token: invite.token,
      }),
    ).rejects.toBeInstanceOf(InvitationError);

    const first = await acceptHouseholdInvitation({
      userId: spouse.id,
      email: spouse.email,
      token: invite.token,
    });
    expect(first.role).toBe("MEMBER");

    const second = await acceptHouseholdInvitation({
      userId: spouse.id,
      email: spouse.email,
      token: invite.token,
    });
    expect(second.householdId).toBe(created.household.id);

    const members = await db
      .select()
      .from(householdMembers)
      .where(eq(householdMembers.householdId, created.household.id));
    expect(members.filter((member) => member.userId === spouse.id)).toHaveLength(1);

    const revoked = await createHouseholdInvitation({
      userId: owner.id,
      householdId: created.household.id,
      email: "novo@example.test",
    });
    const [revocable] = await db
      .select({ id: householdInvitations.id })
      .from(householdInvitations)
      .where(eq(householdInvitations.tokenHash, hashInviteToken(revoked.token)));

    await revokeHouseholdInvitation({
      userId: owner.id,
      householdId: created.household.id,
      invitationId: revocable!.id,
    });

    await expect(
      acceptHouseholdInvitation({
        userId: stranger.id,
        email: "novo@example.test",
        token: revoked.token,
      }),
    ).rejects.toMatchObject({ code: "revoked" });

    const expiredToken = "expired-token-for-tests-aaaa";
    await db.insert(householdInvitations).values({
      id: crypto.randomUUID(),
      householdId: created.household.id,
      email: stranger.email,
      tokenHash: hashInviteToken(expiredToken),
      expiresAt: new Date("2020-01-01T00:00:00.000Z"),
      invitedByUserId: owner.id,
    });

    await expect(
      acceptHouseholdInvitation({
        userId: stranger.id,
        email: stranger.email,
        token: expiredToken,
      }),
    ).rejects.toMatchObject({ code: "expired" });
  });

  it("blocks users of another household and users without membership", async () => {
    const ownerA = await insertUser("Owner A");
    const ownerB = await insertUser("Owner B");
    const outsider = await insertUser("Outsider");

    const houseA = await createHouseholdForUser({ userId: ownerA.id, name: "Casa A" });
    const houseB = await createHouseholdForUser({ userId: ownerB.id, name: "Casa B" });
    createdHouseholdIds.push(houseA.household.id, houseB.household.id);

    await expect(assertHouseholdAccessForUser(outsider.id, houseA.household.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(assertHouseholdAccessForUser(ownerB.id, houseA.household.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(
      assertHouseholdAccessForUser(ownerA.id, "00000000-0000-4000-8000-000000000099"),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const allowed = await assertHouseholdAccessForUser(ownerA.id, houseA.household.id);
    expect(allowed.household.id).toBe(houseA.household.id);
    expect(houseB.household.id).not.toBe(houseA.household.id);
  });
});
