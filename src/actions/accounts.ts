"use server";

import { ForbiddenError } from "@/lib/access";
import { getActiveHousehold, requireHouseholdOwner } from "@/lib/require-household";
import { requireSession } from "@/lib/require-session";
import {
  deactivateFinancialAccountSchema,
  financialAccountSchema,
  updateFinancialAccountSchema,
} from "@/lib/validations/household";
import {
  createFinancialAccount,
  deactivateFinancialAccount,
  updateFinancialAccount,
} from "@/services/accounts";

export type ActionResult = { ok: true } | { ok: false; error: string };

function toActionError(error: unknown): ActionResult {
  if (error instanceof ForbiddenError) {
    return { ok: false, error: "Você não tem permissão para esta ação." };
  }

  return { ok: false, error: "Não foi possível salvar a conta." };
}

async function resolveOwnedHousehold(userId: string) {
  const active = await getActiveHousehold(userId);
  if (!active) {
    throw new ForbiddenError();
  }

  await requireHouseholdOwner(active.household.id);
  return active.household.id;
}

export async function createAccountAction(input: unknown): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = financialAccountSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const householdId = await resolveOwnedHousehold(session.user.id);
    await createFinancialAccount({
      userId: session.user.id,
      householdId,
      name: parsed.data.name,
      institutionName: parsed.data.institutionName,
      type: parsed.data.type,
      openingBalanceCents: parsed.data.openingBalanceCents,
      openingBalanceDate: parsed.data.openingBalanceDate,
    });
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateAccountAction(input: unknown): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = updateFinancialAccountSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const householdId = await resolveOwnedHousehold(session.user.id);
    const account = await updateFinancialAccount({
      userId: session.user.id,
      householdId,
      accountId: parsed.data.accountId,
      name: parsed.data.name,
      institutionName: parsed.data.institutionName,
      type: parsed.data.type,
      openingBalanceCents: parsed.data.openingBalanceCents,
      openingBalanceDate: parsed.data.openingBalanceDate,
    });

    if (!account) {
      return { ok: false, error: "Conta não encontrada." };
    }

    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deactivateAccountAction(input: unknown): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = deactivateFinancialAccountSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const householdId = await resolveOwnedHousehold(session.user.id);
    const account = await deactivateFinancialAccount({
      userId: session.user.id,
      householdId,
      accountId: parsed.data.accountId,
    });

    if (!account) {
      return { ok: false, error: "Conta não encontrada." };
    }

    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}
