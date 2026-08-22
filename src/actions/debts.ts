"use server";

import { ForbiddenError } from "@/lib/access";
import { requireHouseholdMembership } from "@/lib/require-household";
import { debtSchema, debtStatusSchema, payDebtSchema } from "@/lib/validations/debts";
import { createDebt, DebtError, payDebtInstallment, updateDebtStatus } from "@/services/debts";
import { LedgerError } from "@/services/transactions";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function toError(error: unknown): ActionResult {
  if (
    typeof error === "object" &&
    error &&
    "digest" in error &&
    String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
  ) {
    throw error;
  }

  if (error instanceof ForbiddenError) {
    return { ok: false, error: "Você não tem permissão para esta ação." };
  }

  if (error instanceof DebtError || error instanceof LedgerError) {
    return { ok: false, error: error.message };
  }

  return { ok: false, error: "Não foi possível salvar a dívida." };
}

export async function createDebtAction(input: unknown): Promise<ActionResult> {
  const parsed = debtSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const { session, household } = await requireHouseholdMembership();
    const debt = await createDebt({
      userId: session.user.id,
      householdId: household.id,
      name: parsed.data.name,
      creditor: parsed.data.creditor,
      categoryId: parsed.data.categoryId,
      originalAmountCents: parsed.data.originalAmountCents,
      outstandingBalanceCents: parsed.data.outstandingBalanceCents,
      installmentAmountCents: parsed.data.installmentAmountCents,
      totalInstallments: parsed.data.totalInstallments,
      annualInterestRateBasisPoints: parsed.data.annualInterestRateBasisPoints,
      firstDueDate: parsed.data.firstDueDate,
      notes: parsed.data.notes,
    });
    return { ok: true, id: debt?.id };
  } catch (error) {
    return toError(error);
  }
}

export async function payDebtInstallmentAction(input: unknown): Promise<ActionResult> {
  const parsed = payDebtSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const { session, household } = await requireHouseholdMembership();
    await payDebtInstallment({
      userId: session.user.id,
      householdId: household.id,
      debtId: parsed.data.debtId,
      installmentId: parsed.data.installmentId,
      accountId: parsed.data.accountId,
    });
    return { ok: true };
  } catch (error) {
    return toError(error);
  }
}

export async function updateDebtStatusAction(input: unknown): Promise<ActionResult> {
  const parsed = debtStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos." };
  }

  try {
    const { session, household } = await requireHouseholdMembership();
    await updateDebtStatus({
      userId: session.user.id,
      householdId: household.id,
      debtId: parsed.data.debtId,
      status: parsed.data.status,
    });
    return { ok: true };
  } catch (error) {
    return toError(error);
  }
}
