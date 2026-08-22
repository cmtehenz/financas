"use server";

import { redirect } from "next/navigation";

import { ForbiddenError } from "@/lib/access";
import { writeActiveHouseholdCookie } from "@/lib/active-household";
import { getActiveHousehold, requireHouseholdOwner } from "@/lib/require-household";
import { requireSession } from "@/lib/require-session";
import { getSafeInternalPath } from "@/lib/safe-redirect";
import {
  acceptInvitationSchema,
  createInvitationSchema,
  revokeInvitationSchema,
} from "@/lib/validations/household";
import {
  acceptHouseholdInvitation,
  createHouseholdInvitation,
  InvitationError,
  revokeHouseholdInvitation,
} from "@/services/invitations";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CreateInviteResult =
  | { ok: true; invitePath: string }
  | { ok: false; error: string };

function toInviteError(error: unknown): { ok: false; error: string } {
  if (error instanceof ForbiddenError) {
    return { ok: false, error: "Somente quem administra a Casa pode gerenciar convites." };
  }

  if (error instanceof InvitationError) {
    return { ok: false, error: error.message };
  }

  return { ok: false, error: "Não foi possível concluir o convite." };
}

export async function createInvitationAction(input: unknown): Promise<CreateInviteResult> {
  const session = await requireSession();
  const parsed = createInvitationSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const active = await getActiveHousehold(session.user.id);
    if (!active) {
      return { ok: false, error: "Crie a Casa antes de convidar." };
    }

    await requireHouseholdOwner(active.household.id);
    const created = await createHouseholdInvitation({
      userId: session.user.id,
      householdId: active.household.id,
      email: parsed.data.email,
    });

    return {
      ok: true,
      invitePath: `/convite/${created.token}`,
    };
  } catch (error) {
    return toInviteError(error);
  }
}

export async function revokeInvitationAction(input: unknown): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = revokeInvitationSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const active = await getActiveHousehold(session.user.id);
    if (!active) {
      return { ok: false, error: "Casa não encontrada." };
    }

    await requireHouseholdOwner(active.household.id);
    await revokeHouseholdInvitation({
      userId: session.user.id,
      householdId: active.household.id,
      invitationId: parsed.data.invitationId,
    });
    return { ok: true };
  } catch (error) {
    return toInviteError(error);
  }
}

export async function acceptInvitationAction(input: unknown): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = acceptInvitationSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "Este convite é inválido ou expirou." };
  }

  try {
    const accepted = await acceptHouseholdInvitation({
      userId: session.user.id,
      email: session.user.email,
      token: parsed.data.token,
    });
    await writeActiveHouseholdCookie(accepted.householdId);
    return { ok: true };
  } catch (error) {
    return toInviteError(error);
  }
}

export async function acceptInvitationAndGoHome(input: unknown) {
  const result = await acceptInvitationAction(input);

  if (!result.ok) {
    return result;
  }

  redirect(getSafeInternalPath("/dashboard"));
}
