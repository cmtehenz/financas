"use server";

import { redirect } from "next/navigation";

import { ForbiddenError } from "@/lib/access";
import { writeActiveHouseholdCookie } from "@/lib/active-household";
import { getActiveHousehold, requireHouseholdOwner } from "@/lib/require-household";
import { requireSession } from "@/lib/require-session";
import {
  createHouseholdSchema,
  updateHouseholdSchema,
  type CreateHouseholdInput,
  type UpdateHouseholdInput,
} from "@/lib/validations/household";
import {
  completeHouseholdOnboarding,
  createHouseholdForUser,
  updateHouseholdName,
} from "@/services/households";

export type ActionResult = { ok: true } | { ok: false; error: string };

function toActionError(error: unknown): ActionResult {
  if (error instanceof ForbiddenError) {
    return { ok: false, error: "Você não tem permissão para esta ação." };
  }

  if (error instanceof Error && error.message === "ONBOARDING_ACCOUNT_REQUIRED") {
    return { ok: false, error: "Cadastre pelo menos uma conta para concluir." };
  }

  return { ok: false, error: "Não foi possível concluir. Tente novamente." };
}

export async function createHouseholdAction(input: CreateHouseholdInput): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = createHouseholdSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const created = await createHouseholdForUser({
      userId: session.user.id,
      name: parsed.data.name,
      currency: parsed.data.currency,
      timezone: parsed.data.timezone,
    });
    await writeActiveHouseholdCookie(created.household.id);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function completeOnboardingAction(): Promise<ActionResult> {
  const session = await requireSession();
  const active = await getActiveHousehold(session.user.id);

  if (!active) {
    return { ok: false, error: "Crie a Casa antes de concluir." };
  }

  try {
    await completeHouseholdOnboarding(session.user.id, active.household.id);
    await writeActiveHouseholdCookie(active.household.id);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateHouseholdAction(input: UpdateHouseholdInput): Promise<ActionResult> {
  const parsed = updateHouseholdSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const context = await requireHouseholdOwner();
    await updateHouseholdName(context.session.user.id, context.household.id, parsed.data.name);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function finishOnboardingAndGoHome() {
  const result = await completeOnboardingAction();

  if (!result.ok) {
    return result;
  }

  redirect("/dashboard");
}
