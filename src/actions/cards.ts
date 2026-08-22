"use server";

import { ForbiddenError } from "@/lib/access";
import { requireHouseholdMembership } from "@/lib/require-household";
import {
  cancelPurchaseSchema,
  cardPaymentSchema,
  cardPurchaseSchema,
  creditCardSchema,
} from "@/lib/validations/cards";
import { CardError, cancelCardPurchase, createCardPurchase, createCreditCard, payCardStatement } from "@/services/cards";
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

  if (error instanceof CardError || error instanceof LedgerError) {
    return { ok: false, error: error.message };
  }

  return { ok: false, error: "Não foi possível salvar o cartão." };
}

export async function createCreditCardAction(input: unknown): Promise<ActionResult> {
  const parsed = creditCardSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const { session, household } = await requireHouseholdMembership();
    const card = await createCreditCard({
      userId: session.user.id,
      householdId: household.id,
      name: parsed.data.name,
      issuer: parsed.data.issuer,
      holderUserId: parsed.data.holderUserId,
      lastFourDigits: parsed.data.lastFourDigits,
      limitCents: parsed.data.limitCents,
      closingDay: parsed.data.closingDay,
      dueDay: parsed.data.dueDay,
    });
    return { ok: true, id: card?.id };
  } catch (error) {
    return toError(error);
  }
}

export async function createCardPurchaseAction(input: unknown): Promise<ActionResult> {
  const creditCardId =
    input && typeof input === "object" && "creditCardId" in input && typeof input.creditCardId === "string"
      ? input.creditCardId
      : "";
  const parsed = cardPurchaseSchema.safeParse(input);
  if (!parsed.success || !creditCardId) {
    return { ok: false, error: parsed.success ? "Cartão inválido." : parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const { session, household } = await requireHouseholdMembership();
    const purchase = await createCardPurchase({
      userId: session.user.id,
      householdId: household.id,
      creditCardId,
      categoryId: parsed.data.categoryId,
      assignedToUserId: parsed.data.assignedToUserId,
      description: parsed.data.description,
      totalAmountCents: parsed.data.totalAmountCents,
      purchaseDate: parsed.data.purchaseDate,
      installmentCount: parsed.data.installmentCount,
      notes: parsed.data.notes,
    });
    return { ok: true, id: purchase?.id };
  } catch (error) {
    return toError(error);
  }
}

export async function cancelCardPurchaseAction(input: unknown): Promise<ActionResult> {
  const parsed = cancelPurchaseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Compra inválida." };
  }

  try {
    const { session, household } = await requireHouseholdMembership();
    await cancelCardPurchase({
      userId: session.user.id,
      householdId: household.id,
      purchaseId: parsed.data.purchaseId,
    });
    return { ok: true };
  } catch (error) {
    return toError(error);
  }
}

export async function payCardStatementAction(input: unknown): Promise<ActionResult> {
  const parsed = cardPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const { session, household } = await requireHouseholdMembership();
    const payment = await payCardStatement({
      userId: session.user.id,
      householdId: household.id,
      statementId: parsed.data.statementId,
      accountId: parsed.data.accountId,
      amountCents: parsed.data.amountCents,
      paidAt: new Date(`${parsed.data.paidAt}T12:00:00-03:00`),
      idempotencyKey: parsed.data.idempotencyKey,
    });
    return { ok: true, id: payment?.id };
  } catch (error) {
    return toError(error);
  }
}
