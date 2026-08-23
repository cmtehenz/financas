"use server";

import { ForbiddenError } from "@/lib/access";
import { toCents } from "@/lib/money";
import { requireHouseholdMembership } from "@/lib/require-household";
import {
  copyPlanningMonthSchema,
  makePlanningRecurringSchema,
  settlePlanningItemSchema,
  transactionIdSchema,
} from "@/lib/validations/ledger";
import { LedgerError } from "@/services/transactions";
import { markTransactionPendingAction, cancelTransactionAction } from "@/actions/transactions";
import {
  copyPreviousMonthPlanning,
  makePlanningItemRecurring,
  PlanningError,
  settleInvestmentRemainder,
  settlePlanningLedgerItem,
} from "@/services/planning";

export type ActionResult = { ok: true; id?: string; created?: number } | { ok: false; error: string };

function isRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

function toError(error: unknown): ActionResult {
  if (isRedirectError(error)) {
    throw error;
  }

  if (error instanceof ForbiddenError) {
    return { ok: false, error: "Você não tem permissão para esta ação." };
  }

  if (error instanceof PlanningError || error instanceof LedgerError) {
    return { ok: false, error: error.message };
  }

  return { ok: false, error: "Não foi possível atualizar o planner." };
}

export async function settlePlanningItemAction(input: unknown): Promise<ActionResult> {
  const parsed = settlePlanningItemSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const { session, household } = await requireHouseholdMembership();
    const amountCents = toCents(parsed.data.amount);

    if (parsed.data.kind === "INVESTMENT") {
      await settleInvestmentRemainder({
        userId: session.user.id,
        householdId: household.id,
        year: parsed.data.year ?? 2000,
        month: parsed.data.month ?? 1,
        amountCents,
        accountId: parsed.data.accountId,
        paidAt: parsed.data.paidAt,
      });
      return { ok: true };
    }

    await settlePlanningLedgerItem({
      userId: session.user.id,
      householdId: household.id,
      transactionId: parsed.data.itemId,
      amountCents,
      accountId: parsed.data.accountId,
      paidAt: parsed.data.paidAt,
    });
    return { ok: true };
  } catch (error) {
    return toError(error);
  }
}

export async function copyPreviousMonthPlanningAction(input: unknown): Promise<ActionResult> {
  const parsed = copyPlanningMonthSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const { session, household } = await requireHouseholdMembership();
    const result = await copyPreviousMonthPlanning({
      userId: session.user.id,
      householdId: household.id,
      year: parsed.data.year,
      month: parsed.data.month,
      transactionIds: parsed.data.transactionIds,
    });
    return { ok: true, created: result.created };
  } catch (error) {
    return toError(error);
  }
}

export async function makePlanningItemRecurringAction(input: unknown): Promise<ActionResult> {
  const parsed = makePlanningRecurringSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const { session, household } = await requireHouseholdMembership();
    await makePlanningItemRecurring({
      userId: session.user.id,
      householdId: household.id,
      transactionId: parsed.data.transactionId,
      dueDay: parsed.data.dueDay,
    });
    return { ok: true };
  } catch (error) {
    return toError(error);
  }
}

export async function markPlanningIncomePendingAction(input: unknown): Promise<ActionResult> {
  return markTransactionPendingAction(input);
}

export async function cancelPlanningItemAction(input: unknown): Promise<ActionResult> {
  const parsed = transactionIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Movimentação inválida." };
  }

  return cancelTransactionAction(parsed.data);
}
