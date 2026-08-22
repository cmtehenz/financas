import { and, count, eq, sql } from "drizzle-orm";

import { getDb, type AppDatabase } from "@/db";
import { categories, financialAccounts, householdMembers, households } from "@/db/schema";
import { user } from "@/db/schema/auth";
import { SEED_CATEGORIES } from "@/domain/seed-categories";
import { ForbiddenError, assertHouseholdAccess, assertHouseholdOwner } from "@/lib/access";
import { createId, isUuid } from "@/lib/ids";

type Db = AppDatabase;

export type HouseholdRole = "OWNER" | "MEMBER";

export type HouseholdRecord = {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  onboardingCompletedAt: Date | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type HouseholdMembershipRecord = {
  household: HouseholdRecord;
  membership: {
    id: string;
    householdId: string;
    userId: string;
    role: HouseholdRole;
  };
};

function asRole(value: string): HouseholdRole {
  if (value === "OWNER" || value === "MEMBER") {
    return value;
  }

  throw new ForbiddenError();
}

export async function getUserHouseholds(
  userId: string,
  db: Db = getDb(),
): Promise<HouseholdMembershipRecord[]> {
  const rows = await db
    .select({
      household: households,
      membershipId: householdMembers.id,
      membershipRole: householdMembers.role,
      membershipUserId: householdMembers.userId,
      membershipHouseholdId: householdMembers.householdId,
    })
    .from(householdMembers)
    .innerJoin(households, eq(households.id, householdMembers.householdId))
    .where(eq(householdMembers.userId, userId));

  return rows.map((row) => ({
    household: row.household,
    membership: {
      id: row.membershipId,
      householdId: row.membershipHouseholdId,
      userId: row.membershipUserId,
      role: asRole(row.membershipRole),
    },
  }));
}

export async function findHouseholdMembership(userId: string, householdId: string, db: Db = getDb()) {
  if (!isUuid(householdId)) {
    return null;
  }

  const [row] = await db
    .select({
      household: households,
      membershipId: householdMembers.id,
      membershipRole: householdMembers.role,
      membershipUserId: householdMembers.userId,
      membershipHouseholdId: householdMembers.householdId,
    })
    .from(householdMembers)
    .innerJoin(households, eq(households.id, householdMembers.householdId))
    .where(and(eq(householdMembers.userId, userId), eq(householdMembers.householdId, householdId)))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    household: row.household,
    membership: {
      id: row.membershipId,
      householdId: row.membershipHouseholdId,
      userId: row.membershipUserId,
      role: asRole(row.membershipRole),
    },
  } satisfies HouseholdMembershipRecord;
}

export async function assertHouseholdAccessForUser(
  userId: string,
  householdId: string,
  db: Db = getDb(),
) {
  const membership = await findHouseholdMembership(userId, householdId, db);
  assertHouseholdAccess(membership?.membership);
  return membership;
}

export async function requireHouseholdOwnerRecord(
  userId: string,
  householdId: string,
  db: Db = getDb(),
) {
  const membership = await findHouseholdMembership(userId, householdId, db);
  assertHouseholdOwner(membership?.membership);
  return membership;
}

export async function countActiveAccounts(householdId: string, db: Db = getDb()) {
  const [row] = await db
    .select({ n: count() })
    .from(financialAccounts)
    .where(
      and(
        eq(financialAccounts.householdId, householdId),
        eq(financialAccounts.active, true),
        sql`${financialAccounts.deletedAt} is null`,
      ),
    );

  return row?.n ?? 0;
}

export async function createHouseholdForUser(
  input: {
    userId: string;
    name: string;
    currency?: "BRL";
    timezone?: "America/Sao_Paulo";
  },
  db: Db = getDb(),
) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.userId}))`);

    const existing = await getUserHouseholds(input.userId, tx as unknown as Db);
    if (existing[0]) {
      return existing[0];
    }

    const householdId = createId();
    const now = new Date();

    const [household] = await tx
      .insert(households)
      .values({
        id: householdId,
        name: input.name,
        currency: input.currency ?? "BRL",
        timezone: input.timezone ?? "America/Sao_Paulo",
        createdByUserId: input.userId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!household) {
      throw new Error("HOUSEHOLD_CREATE_FAILED");
    }

    const [membership] = await tx
      .insert(householdMembers)
      .values({
        id: createId(),
        householdId,
        userId: input.userId,
        role: "OWNER",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!membership) {
      throw new Error("HOUSEHOLD_MEMBER_CREATE_FAILED");
    }

    await tx
      .insert(categories)
      .values(
        SEED_CATEGORIES.map((category) => ({
          id: createId(),
          householdId,
          name: category.name,
          slug: category.slug,
          type: category.type,
          kind: category.kind,
          color: category.color,
          icon: category.icon,
          active: true,
          systemDefault: true,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .onConflictDoNothing({
        target: [categories.householdId, categories.type, categories.slug],
      });

    return {
      household,
      membership: {
        id: membership.id,
        householdId: membership.householdId,
        userId: membership.userId,
        role: asRole(membership.role),
      },
    } satisfies HouseholdMembershipRecord;
  });
}

export async function seedHouseholdCategories(householdId: string, db: Db = getDb()) {
  const now = new Date();

  await db
    .insert(categories)
    .values(
      SEED_CATEGORIES.map((category) => ({
        id: createId(),
        householdId,
        name: category.name,
        slug: category.slug,
        type: category.type,
        kind: category.kind,
        color: category.color,
        icon: category.icon,
        active: true,
        systemDefault: true,
        createdAt: now,
        updatedAt: now,
      })),
    )
    .onConflictDoNothing({
      target: [categories.householdId, categories.type, categories.slug],
    });

  const rows = await db
    .select({ n: count() })
    .from(categories)
    .where(eq(categories.householdId, householdId));

  return rows[0]?.n ?? 0;
}

export async function completeHouseholdOnboarding(userId: string, householdId: string, db: Db = getDb()) {
  return db.transaction(async (tx) => {
    const membership = await requireHouseholdOwnerRecord(userId, householdId, tx as unknown as Db);
    const accountCount = await countActiveAccounts(householdId, tx as unknown as Db);

    if (accountCount < 1) {
      throw new Error("ONBOARDING_ACCOUNT_REQUIRED");
    }

    if (membership.household.onboardingCompletedAt) {
      return membership;
    }

    const [household] = await tx
      .update(households)
      .set({ onboardingCompletedAt: new Date(), updatedAt: new Date() })
      .where(eq(households.id, householdId))
      .returning();

    return {
      ...membership,
      household: household ?? membership.household,
    };
  });
}

export async function updateHouseholdName(
  userId: string,
  householdId: string,
  name: string,
  db: Db = getDb(),
) {
  await requireHouseholdOwnerRecord(userId, householdId, db);

  const [household] = await db
    .update(households)
    .set({ name, updatedAt: new Date() })
    .where(eq(households.id, householdId))
    .returning();

  return household;
}

export async function listHouseholdMembers(householdId: string, db: Db = getDb()) {
  return db
    .select({
      id: householdMembers.id,
      role: householdMembers.role,
      userId: householdMembers.userId,
      name: user.name,
      email: user.email,
    })
    .from(householdMembers)
    .innerJoin(user, eq(user.id, householdMembers.userId))
    .where(eq(householdMembers.householdId, householdId));
}

export async function countHouseholdCategories(householdId: string, db: Db = getDb()) {
  const [row] = await db
    .select({ n: count() })
    .from(categories)
    .where(eq(categories.householdId, householdId));

  return row?.n ?? 0;
}
