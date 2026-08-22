import { and, eq, sql } from "drizzle-orm";

import { getDb, type AppDatabase } from "@/db";
import { householdInvitations, householdMembers, households } from "@/db/schema";
import { user } from "@/db/schema/auth";
import {
  decideInvitationAcceptance,
  invitationPublicMessage,
  normalizeEmail,
} from "@/domain/invitation-rules";
import { createId } from "@/lib/ids";
import { createInviteToken, hashInviteToken, inviteExpiresAt } from "@/lib/invite-token";

import { requireHouseholdOwnerRecord } from "./households";

type Db = AppDatabase;

export class InvitationError extends Error {
  constructor(
    message: string,
    readonly code:
      | "invalid"
      | "expired"
      | "revoked"
      | "used"
      | "email_mismatch"
      | "already_member",
  ) {
    super(message);
    this.name = "InvitationError";
  }
}

export async function createHouseholdInvitation(
  input: { userId: string; householdId: string; email: string },
  db: Db = getDb(),
) {
  const membership = await requireHouseholdOwnerRecord(input.userId, input.householdId, db);
  const email = normalizeEmail(input.email);
  const token = createInviteToken();
  const tokenHash = hashInviteToken(token);
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(householdInvitations)
      .set({ revokedAt: now })
      .where(
        and(
          eq(householdInvitations.householdId, input.householdId),
          eq(householdInvitations.email, email),
          sql`${householdInvitations.acceptedAt} is null`,
          sql`${householdInvitations.revokedAt} is null`,
        ),
      );

    await tx.insert(householdInvitations).values({
      id: createId(),
      householdId: input.householdId,
      email,
      tokenHash,
      expiresAt: inviteExpiresAt(now),
      invitedByUserId: input.userId,
      createdAt: now,
    });
  });

  return {
    householdName: membership.household.name,
    email,
    token,
  };
}

export async function revokeHouseholdInvitation(
  input: { userId: string; householdId: string; invitationId: string },
  db: Db = getDb(),
) {
  await requireHouseholdOwnerRecord(input.userId, input.householdId, db);

  const [invitation] = await db
    .update(householdInvitations)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(householdInvitations.id, input.invitationId),
        eq(householdInvitations.householdId, input.householdId),
        sql`${householdInvitations.acceptedAt} is null`,
      ),
    )
    .returning({ id: householdInvitations.id });

  return invitation ?? null;
}

export async function listHouseholdInvitations(householdId: string, db: Db = getDb()) {
  return db
    .select({
      id: householdInvitations.id,
      email: householdInvitations.email,
      expiresAt: householdInvitations.expiresAt,
      acceptedAt: householdInvitations.acceptedAt,
      revokedAt: householdInvitations.revokedAt,
      createdAt: householdInvitations.createdAt,
    })
    .from(householdInvitations)
    .where(eq(householdInvitations.householdId, householdId));
}

export async function inspectInvitationByToken(token: string, db: Db = getDb()) {
  const tokenHash = hashInviteToken(token);
  const [row] = await db
    .select({
      id: householdInvitations.id,
      email: householdInvitations.email,
      expiresAt: householdInvitations.expiresAt,
      acceptedAt: householdInvitations.acceptedAt,
      revokedAt: householdInvitations.revokedAt,
      householdId: householdInvitations.householdId,
      householdName: households.name,
      invitedByName: user.name,
    })
    .from(householdInvitations)
    .innerJoin(households, eq(households.id, householdInvitations.householdId))
    .innerJoin(user, eq(user.id, householdInvitations.invitedByUserId))
    .where(eq(householdInvitations.tokenHash, tokenHash))
    .limit(1);

  return row ?? null;
}

export async function previewInvitation(token: string, db: Db = getDb()) {
  const invitation = await inspectInvitationByToken(token, db);
  const decision = decideInvitationAcceptance(invitation, { email: invitation?.email ?? "" });

  if (!invitation || !decision.ok) {
    return {
      ok: false as const,
      error: invitationPublicMessage(decision.ok ? "invalid" : decision.reason),
    };
  }

  return {
    ok: true as const,
    householdName: invitation.householdName,
    invitedByName: invitation.invitedByName,
    email: invitation.email,
  };
}

export async function acceptHouseholdInvitation(
  input: { userId: string; email: string; token: string },
  db: Db = getDb(),
) {
  const tokenHash = hashInviteToken(input.token);
  const email = normalizeEmail(input.email);

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${tokenHash}))`);

    const [invitation] = await tx
      .select()
      .from(householdInvitations)
      .where(eq(householdInvitations.tokenHash, tokenHash))
      .limit(1);

    if (!invitation) {
      throw new InvitationError(invitationPublicMessage("invalid"), "invalid");
    }

    const [existing] = await tx
      .select({ id: householdMembers.id, role: householdMembers.role })
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, invitation.householdId),
          eq(householdMembers.userId, input.userId),
        ),
      )
      .limit(1);

    const now = new Date();

    if (existing) {
      if (!invitation.acceptedAt) {
        await tx
          .update(householdInvitations)
          .set({ acceptedAt: now })
          .where(
            and(eq(householdInvitations.id, invitation.id), sql`${householdInvitations.acceptedAt} is null`),
          );
      }

      const [household] = await tx
        .select()
        .from(households)
        .where(eq(households.id, invitation.householdId))
        .limit(1);

      return {
        householdId: invitation.householdId,
        householdName: household?.name ?? "",
        role: existing.role === "OWNER" ? "OWNER" : "MEMBER",
      };
    }

    const decision = decideInvitationAcceptance(invitation, { email });

    if (!decision.ok) {
      throw new InvitationError(invitationPublicMessage(decision.reason), decision.reason);
    }

    await tx
      .insert(householdMembers)
      .values({
        id: createId(),
        householdId: invitation.householdId,
        userId: input.userId,
        role: "MEMBER",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({
        target: [householdMembers.householdId, householdMembers.userId],
      });

    await tx
      .update(householdInvitations)
      .set({ acceptedAt: now })
      .where(
        and(eq(householdInvitations.id, invitation.id), sql`${householdInvitations.acceptedAt} is null`),
      );

    const [household] = await tx
      .select()
      .from(households)
      .where(eq(households.id, invitation.householdId))
      .limit(1);

    return {
      householdId: invitation.householdId,
      householdName: household?.name ?? "",
      role: "MEMBER",
    };
  });
}

export function hasPendingInvitation(
  invitations: Array<{ acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date }>,
  now = new Date(),
) {
  return invitations.some(
    (invitation) =>
      !invitation.acceptedAt && !invitation.revokedAt && invitation.expiresAt.getTime() > now.getTime(),
  );
}
