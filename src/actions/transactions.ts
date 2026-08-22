"use server";

import { ForbiddenError } from "@/lib/access";
import { parseYearMonth, todayInSaoPaulo } from "@/lib/dates";
import { requireHouseholdMembership } from "@/lib/require-household";
import {
  transactionIdSchema,
  transactionSchema,
  updateTransactionSchema,
} from "@/lib/validations/ledger";
import { createRecurringRule, materializeRecurrencesForMonth } from "@/services/recurrences";
import { createTransaction, LedgerError, setTransactionStatus, updateTransaction } from "@/services/transactions";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

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

  if (error instanceof LedgerError) {
    return { ok: false, error: error.message };
  }

  return { ok: false, error: "Não foi possível salvar a movimentação." };
}

export async function createTransactionAction(input: unknown): Promise<ActionResult> {
  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const { session, household } = await requireHouseholdMembership();
    const values = parsed.data;

    if (values.recurring && values.type !== "TRANSFER") {
      const parsedDueDay = Number(values.dueDay);
      const dueDay =
        Number.isInteger(parsedDueDay) && parsedDueDay >= 1 && parsedDueDay <= 31
          ? parsedDueDay
          : Number(values.transactionDate.slice(8, 10));
      const rule = await createRecurringRule({
        userId: session.user.id,
        householdId: household.id,
        accountId: values.accountId,
        categoryId: values.categoryId ?? "",
        assignedToUserId: values.assignedToUserId,
        description: values.description,
        type: values.type,
        amountCents: values.amountCents,
        dueDay,
        startDate: values.transactionDate.slice(0, 8) + "01",
        defaultStatus: values.status === "PAID" ? "PENDING" : values.status,
      });
      const month = parseYearMonth(values.transactionDate.slice(0, 7));
      await materializeRecurrencesForMonth({
        userId: session.user.id,
        householdId: household.id,
        year: month.year,
        month: month.month,
      });
      return { ok: true, id: rule?.id };
    }

    const created = await createTransaction({
      userId: session.user.id,
      householdId: household.id,
      type: values.type,
      description: values.description,
      amountCents: values.amountCents,
      accountId: values.accountId,
      destinationAccountId: values.destinationAccountId,
      categoryId: values.categoryId,
      assignedToUserId: values.assignedToUserId,
      transactionDate: values.transactionDate,
      dueDate: values.dueDate,
      status: values.status,
      notes: values.notes,
    });

    return { ok: true, id: created?.id };
  } catch (error) {
    return toError(error);
  }
}

export async function updateTransactionAction(input: unknown): Promise<ActionResult> {
  const parsed = updateTransactionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const { session, household } = await requireHouseholdMembership();
    await updateTransaction({
      userId: session.user.id,
      householdId: household.id,
      transactionId: parsed.data.transactionId,
      type: parsed.data.type,
      description: parsed.data.description,
      amountCents: parsed.data.amountCents,
      accountId: parsed.data.accountId,
      destinationAccountId: parsed.data.destinationAccountId,
      categoryId: parsed.data.categoryId,
      assignedToUserId: parsed.data.assignedToUserId,
      transactionDate: parsed.data.transactionDate,
      dueDate: parsed.data.dueDate,
      status: parsed.data.status,
      notes: parsed.data.notes,
    });
    return { ok: true };
  } catch (error) {
    return toError(error);
  }
}

export async function markTransactionPaidAction(input: unknown): Promise<ActionResult> {
  return changeStatus(input, "PAID");
}

export async function markTransactionPendingAction(input: unknown): Promise<ActionResult> {
  return changeStatus(input, "PENDING");
}

export async function cancelTransactionAction(input: unknown): Promise<ActionResult> {
  return changeStatus(input, "CANCELLED");
}

export async function deleteTransactionAction(input: unknown): Promise<ActionResult> {
  return changeStatus(input, "CANCELLED", true);
}

async function changeStatus(
  input: unknown,
  status: "PAID" | "PENDING" | "CANCELLED",
  softDelete = false,
): Promise<ActionResult> {
  const parsed = transactionIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Movimentação inválida." };
  }

  try {
    const { session, household } = await requireHouseholdMembership();
    await setTransactionStatus({
      userId: session.user.id,
      householdId: household.id,
      transactionId: parsed.data.transactionId,
      status,
      softDelete,
    });
    return { ok: true };
  } catch (error) {
    return toError(error);
  }
}

export async function materializeCurrentMonthAction(): Promise<ActionResult> {
  try {
    const { session, household } = await requireHouseholdMembership();
    const { year, month } = parseYearMonth(todayInSaoPaulo().slice(0, 7));
    await materializeRecurrencesForMonth({
      userId: session.user.id,
      householdId: household.id,
      year,
      month,
    });
    return { ok: true };
  } catch (error) {
    return toError(error);
  }
}
