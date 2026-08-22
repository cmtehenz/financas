import { and, eq, inArray, sql } from "drizzle-orm";

import { getDb, type DbClient } from "@/db";
import {
  categories,
  creditCardInstallments,
  creditCardPayments,
  creditCardPurchases,
  creditCards,
  creditCardStatements,
  householdMembers,
} from "@/db/schema";
import {
  cardAvailableLimitCents,
  cardUsedLimitCents,
  deriveStatementStatus,
  previewCardInstallments,
  statementPendingCents,
  unpaidStatementsThrough,
} from "@/domain/cards";
import { ZERO_CENTS } from "@/domain/ledger";
import { todayInSaoPaulo } from "@/lib/dates";
import { ForbiddenError } from "@/lib/access";
import { createId, isUuid } from "@/lib/ids";
import { addCents } from "@/lib/money";
import type { Cents } from "@/types/money";

import { recordAudit } from "./audit";
import { assertHouseholdAccessForUser } from "./households";
import { createTransaction, LedgerError } from "./transactions";

type Db = DbClient;

export class CardError extends Error {
  constructor(
    message: string,
    readonly code:
      | "INACTIVE_CARD"
      | "FOREIGN_CARD"
      | "FOREIGN_STATEMENT"
      | "FOREIGN_ACCOUNT"
      | "INVALID_CARD"
      | "PAID_STATEMENT"
      | "OVERPAY"
      | "DUPLICATE_PAYMENT"
      | "NOT_FOUND",
  ) {
    super(message);
    this.name = "CardError";
  }
}

async function requireMember(householdId: string, userId: string, db: Db) {
  const [member] = await db
    .select({ id: householdMembers.id })
    .from(householdMembers)
    .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)))
    .limit(1);

  if (!member) {
    throw new LedgerError("O titular precisa ser membro desta Casa.", "FOREIGN_MEMBER");
  }
}

async function requireCard(householdId: string, creditCardId: string, db: Db) {
  if (!isUuid(creditCardId)) {
    throw new CardError("Cartão inválido.", "INVALID_CARD");
  }

  const [card] = await db
    .select()
    .from(creditCards)
    .where(and(eq(creditCards.id, creditCardId), eq(creditCards.householdId, householdId)))
    .limit(1);

  if (!card || card.deletedAt) {
    throw new CardError("O cartão não pertence a esta Casa.", "FOREIGN_CARD");
  }

  return card;
}

export async function createCreditCard(
  input: {
    userId: string;
    householdId: string;
    name: string;
    issuer: string;
    holderUserId: string;
    lastFourDigits?: string | null;
    limitCents: Cents;
    closingDay: number;
    dueDay: number;
  },
  db: Db = getDb(),
) {
  await assertHouseholdAccessForUser(input.userId, input.householdId, db);
  await requireMember(input.householdId, input.holderUserId, db);
  if (input.limitCents <= ZERO_CENTS) {
    throw new CardError("Informe um limite maior que zero.", "INVALID_CARD");
  }

  const now = new Date();
  const [card] = await db
    .insert(creditCards)
    .values({
      id: createId(),
      householdId: input.householdId,
      name: input.name.trim(),
      issuer: input.issuer.trim(),
      holderUserId: input.holderUserId,
      lastFourDigits: input.lastFourDigits || null,
      limitCents: input.limitCents,
      closingDay: input.closingDay,
      dueDay: input.dueDay,
      active: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await recordAudit(
    {
      householdId: input.householdId,
      actorUserId: input.userId,
      action: "card.create",
      entityType: "credit_card",
      entityId: card!.id,
      changedFields: ["name", "limitCents"],
    },
    db,
  );

  return card;
}

export async function updateCreditCard(
  input: {
    userId: string;
    householdId: string;
    creditCardId: string;
    name: string;
    issuer: string;
    limitCents: Cents;
    closingDay: number;
    dueDay: number;
  },
  db: Db = getDb(),
) {
  await assertHouseholdAccessForUser(input.userId, input.householdId, db);
  const card = await requireCard(input.householdId, input.creditCardId, db);
  if (input.limitCents <= ZERO_CENTS) {
    throw new CardError("Informe um limite maior que zero.", "INVALID_CARD");
  }

  const [updated] = await db
    .update(creditCards)
    .set({
      name: input.name.trim(),
      issuer: input.issuer.trim(),
      limitCents: input.limitCents,
      closingDay: input.closingDay,
      dueDay: input.dueDay,
      updatedAt: new Date(),
    })
    .where(eq(creditCards.id, card.id))
    .returning();

  await recordAudit(
    {
      householdId: input.householdId,
      actorUserId: input.userId,
      action: "card.update",
      entityType: "credit_card",
      entityId: card.id,
      changedFields: ["name", "issuer", "limitCents", "closingDay", "dueDay"],
    },
    db,
  );

  return updated;
}

export async function setCreditCardActive(
  input: { userId: string; householdId: string; creditCardId: string; active: boolean },
  db: Db = getDb(),
) {
  await assertHouseholdAccessForUser(input.userId, input.householdId, db);
  const card = await requireCard(input.householdId, input.creditCardId, db);
  const [updated] = await db
    .update(creditCards)
    .set({ active: input.active, updatedAt: new Date() })
    .where(eq(creditCards.id, card.id))
    .returning();

  await recordAudit(
    {
      householdId: input.householdId,
      actorUserId: input.userId,
      action: input.active ? "card.reactivate" : "card.deactivate",
      entityType: "credit_card",
      entityId: card.id,
      changedFields: ["active"],
    },
    db,
  );

  return updated;
}

export async function listCreditCards(householdId: string, db: Db = getDb()) {
  return db
    .select()
    .from(creditCards)
    .where(and(eq(creditCards.householdId, householdId), sql`${creditCards.deletedAt} is null`));
}

export async function getCreditCard(householdId: string, creditCardId: string, db: Db = getDb()) {
  if (!isUuid(creditCardId)) {
    return null;
  }

  const [card] = await db
    .select()
    .from(creditCards)
    .where(and(eq(creditCards.id, creditCardId), eq(creditCards.householdId, householdId)))
    .limit(1);

  return card && !card.deletedAt ? card : null;
}

export async function createCardPurchase(
  input: {
    userId: string;
    householdId: string;
    creditCardId: string;
    categoryId: string;
    assignedToUserId?: string | null;
    description: string;
    totalAmountCents: Cents;
    purchaseDate: string;
    installmentCount: number;
    notes?: string | null;
  },
  db: Db = getDb(),
) {
  await assertHouseholdAccessForUser(input.userId, input.householdId, db);
  const card = await requireCard(input.householdId, input.creditCardId, db);
  if (!card.active) {
    throw new CardError("Cartão desativado não aceita novas compras.", "INACTIVE_CARD");
  }

  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, input.categoryId), eq(categories.householdId, input.householdId)))
    .limit(1);

  if (!category || category.type !== "EXPENSE") {
    throw new LedgerError("A categoria precisa ser de despesa desta Casa.", "CATEGORY_MISMATCH");
  }

  if (input.assignedToUserId) {
    await requireMember(input.householdId, input.assignedToUserId, db);
  }

  const preview = previewCardInstallments({
    totalAmountCents: input.totalAmountCents,
    installmentCount: input.installmentCount,
    purchaseDate: input.purchaseDate,
    closingDay: card.closingDay,
    dueDay: card.dueDay,
  });

  const now = new Date();
  const purchaseId = createId();
  const periods = new Map<string, (typeof preview)[number]>();
  for (const installment of preview) {
    periods.set(`${installment.referenceYear}-${installment.referenceMonth}`, installment);
  }

  await db.transaction(async (tx) => {
    await tx.insert(creditCardPurchases).values({
      id: purchaseId,
      householdId: input.householdId,
      creditCardId: card.id,
      categoryId: input.categoryId,
      createdByUserId: input.userId,
      assignedToUserId: input.assignedToUserId || null,
      description: input.description.trim(),
      totalAmountCents: input.totalAmountCents,
      purchaseDate: input.purchaseDate,
      installmentCount: input.installmentCount,
      status: "ACTIVE",
      notes: input.notes || null,
      createdAt: now,
      updatedAt: now,
    });

    const existingStatements = await tx
      .select()
      .from(creditCardStatements)
      .where(
        and(eq(creditCardStatements.householdId, input.householdId), eq(creditCardStatements.creditCardId, card.id)),
      );
    const statementByPeriod = new Map(
      existingStatements.map((item) => [`${item.referenceYear}-${item.referenceMonth}`, item] as const),
    );

    const missing = [...periods.values()].filter(
      (item) => !statementByPeriod.has(`${item.referenceYear}-${item.referenceMonth}`),
    );
    if (missing.length > 0) {
      const created = await tx
        .insert(creditCardStatements)
        .values(
          missing.map((item) => ({
            id: createId(),
            householdId: input.householdId,
            creditCardId: card.id,
            referenceYear: item.referenceYear,
            referenceMonth: item.referenceMonth,
            closingDate: item.closingDate,
            dueDate: item.dueDate,
            status: "OPEN" as const,
            createdAt: now,
            updatedAt: now,
          })),
        )
        .returning();

      for (const statement of created) {
        statementByPeriod.set(`${statement.referenceYear}-${statement.referenceMonth}`, statement);
      }
    }

    await tx.insert(creditCardInstallments).values(
      preview.map((installment) => {
        const statement = statementByPeriod.get(`${installment.referenceYear}-${installment.referenceMonth}`);
        if (!statement) {
          throw new CardError("Não foi possível gerar a fatura da parcela.", "NOT_FOUND");
        }

        return {
          id: createId(),
          householdId: input.householdId,
          purchaseId,
          creditCardId: card.id,
          statementId: statement.id,
          installmentNumber: installment.installmentNumber,
          installmentCount: installment.installmentCount,
          amountCents: installment.amountCents,
          referenceYear: installment.referenceYear,
          referenceMonth: installment.referenceMonth,
          createdAt: now,
        };
      }),
    );

    await recordAudit(
      {
        householdId: input.householdId,
        actorUserId: input.userId,
        action: "card.purchase",
        entityType: "credit_card_purchase",
        entityId: purchaseId,
        changedFields: ["totalAmountCents", "installmentCount"],
      },
      tx,
    );
  });

  return getCreditCardPurchase(input.householdId, purchaseId, db);
}

export async function getCreditCardPurchase(householdId: string, purchaseId: string, db: Db = getDb()) {
  const [purchase] = await db
    .select()
    .from(creditCardPurchases)
    .where(and(eq(creditCardPurchases.id, purchaseId), eq(creditCardPurchases.householdId, householdId)))
    .limit(1);

  return purchase ?? null;
}

export async function cancelCardPurchase(
  input: { userId: string; householdId: string; purchaseId: string },
  db: Db = getDb(),
) {
  await assertHouseholdAccessForUser(input.userId, input.householdId, db);
  const purchase = await getCreditCardPurchase(input.householdId, input.purchaseId, db);
  if (!purchase || purchase.deletedAt) {
    throw new CardError("Compra não encontrada.", "NOT_FOUND");
  }

  const installments = await db
    .select()
    .from(creditCardInstallments)
    .where(eq(creditCardInstallments.purchaseId, purchase.id));
  const statementIds = [...new Set(installments.map((item) => item.statementId))];
  const payments = statementIds.length
    ? await db
        .select()
        .from(creditCardPayments)
        .where(
          and(
            eq(creditCardPayments.householdId, input.householdId),
            inArray(creditCardPayments.statementId, statementIds),
          ),
        )
    : [];

  if (payments.length > 0) {
    throw new CardError("Não é possível cancelar uma compra cuja fatura já foi paga.", "PAID_STATEMENT");
  }

  const [row] = await db
    .update(creditCardPurchases)
    .set({ status: "CANCELLED", updatedAt: new Date() })
    .where(eq(creditCardPurchases.id, purchase.id))
    .returning();

  await recordAudit(
    {
      householdId: input.householdId,
      actorUserId: input.userId,
      action: "card.purchase.cancel",
      entityType: "credit_card_purchase",
      entityId: purchase.id,
      changedFields: ["status"],
    },
    db,
  );

  return row;
}

export async function listCardPurchases(householdId: string, creditCardId: string, db: Db = getDb()) {
  return db
    .select()
    .from(creditCardPurchases)
    .where(
      and(
        eq(creditCardPurchases.householdId, householdId),
        eq(creditCardPurchases.creditCardId, creditCardId),
        sql`${creditCardPurchases.deletedAt} is null`,
      ),
    );
}

export async function listCardInstallments(householdId: string, creditCardId?: string, db: Db = getDb()) {
  if (creditCardId) {
    return db
      .select()
      .from(creditCardInstallments)
      .where(
        and(
          eq(creditCardInstallments.householdId, householdId),
          eq(creditCardInstallments.creditCardId, creditCardId),
        ),
      );
  }

  return db.select().from(creditCardInstallments).where(eq(creditCardInstallments.householdId, householdId));
}

export async function listCardStatements(householdId: string, creditCardId?: string, db: Db = getDb()) {
  if (creditCardId) {
    return db
      .select()
      .from(creditCardStatements)
      .where(
        and(eq(creditCardStatements.householdId, householdId), eq(creditCardStatements.creditCardId, creditCardId)),
      );
  }

  return db.select().from(creditCardStatements).where(eq(creditCardStatements.householdId, householdId));
}

export async function listCardPayments(householdId: string, statementId?: string, db: Db = getDb()) {
  if (statementId) {
    return db
      .select()
      .from(creditCardPayments)
      .where(and(eq(creditCardPayments.householdId, householdId), eq(creditCardPayments.statementId, statementId)));
  }

  return db.select().from(creditCardPayments).where(eq(creditCardPayments.householdId, householdId));
}

export async function getStatementSnapshot(
  householdId: string,
  statementId: string,
  db: Db = getDb(),
) {
  const [statement] = await db
    .select()
    .from(creditCardStatements)
    .where(and(eq(creditCardStatements.id, statementId), eq(creditCardStatements.householdId, householdId)))
    .limit(1);

  if (!statement) {
    throw new CardError("A fatura não pertence a esta Casa.", "FOREIGN_STATEMENT");
  }

  const [installments, payments, purchases] = await Promise.all([
    db.select().from(creditCardInstallments).where(eq(creditCardInstallments.statementId, statement.id)),
    db.select().from(creditCardPayments).where(eq(creditCardPayments.statementId, statement.id)),
    db.select().from(creditCardPurchases).where(eq(creditCardPurchases.householdId, householdId)),
  ]);

  const purchaseById = new Map(purchases.map((item) => [item.id, item]));
  const activeInstallments = installments.filter((item) => purchaseById.get(item.purchaseId)?.status === "ACTIVE");
  const totalCents = addCents(...activeInstallments.map((item) => item.amountCents));
  const paidCents = addCents(...payments.map((item) => item.amountCents));
  const pendingCents = statementPendingCents(totalCents, paidCents);
  const status = deriveStatementStatus({
    today: todayInSaoPaulo(),
    closingDate: statement.closingDate,
    totalCents,
    paidCents,
    cancelled: statement.status === "CANCELLED",
  });

  if (status !== statement.status) {
    await db
      .update(creditCardStatements)
      .set({ status, updatedAt: new Date() })
      .where(eq(creditCardStatements.id, statement.id));
  }

  return {
    statement: { ...statement, status },
    installments: activeInstallments,
    payments,
    totalCents,
    paidCents,
    pendingCents,
  };
}

export async function payCardStatement(
  input: {
    userId: string;
    householdId: string;
    statementId: string;
    accountId: string;
    amountCents: Cents;
    paidAt: Date;
    idempotencyKey: string;
  },
  db: Db = getDb(),
) {
  await assertHouseholdAccessForUser(input.userId, input.householdId, db);

  const [existing] = await db
    .select()
    .from(creditCardPayments)
    .where(
      and(
        eq(creditCardPayments.householdId, input.householdId),
        eq(creditCardPayments.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1);

  if (existing) {
    return existing;
  }

  return db.transaction(async (tx) => {
    const snapshot = await getStatementSnapshot(input.householdId, input.statementId, tx);
    if (input.amountCents > snapshot.pendingCents) {
      throw new CardError("O pagamento não pode ser maior que o saldo da fatura.", "OVERPAY");
    }

    const card = await requireCard(input.householdId, snapshot.statement.creditCardId, tx);
    const transaction = await createTransaction(
      {
        userId: input.userId,
        householdId: input.householdId,
        type: "EXPENSE",
        description: `Fatura ${card.name} ${snapshot.statement.referenceYear}-${String(snapshot.statement.referenceMonth).padStart(2, "0")}`,
        amountCents: input.amountCents,
        accountId: input.accountId,
        transactionDate: todayInSaoPaulo(input.paidAt),
        status: "PAID",
        origin: "CARD_PAYMENT",
        budgetImpact: false,
      },
      tx,
    );

    if (!transaction) {
      throw new CardError("Não foi possível registrar o pagamento.", "NOT_FOUND");
    }

    const [payment] = await tx
      .insert(creditCardPayments)
      .values({
        id: createId(),
        householdId: input.householdId,
        statementId: snapshot.statement.id,
        accountId: input.accountId,
        transactionId: transaction.id,
        amountCents: input.amountCents,
        paidAt: input.paidAt,
        createdByUserId: input.userId,
        idempotencyKey: input.idempotencyKey,
      })
      .returning();

    await getStatementSnapshot(input.householdId, snapshot.statement.id, tx);
    await recordAudit(
      {
        householdId: input.householdId,
        actorUserId: input.userId,
        action: snapshot.pendingCents === input.amountCents ? "card.statement.pay" : "card.statement.partial",
        entityType: "credit_card_statement",
        entityId: snapshot.statement.id,
        changedFields: ["status", "amountCents"],
      },
      tx,
    );

    return payment;
  });
}

export async function householdCardState(householdId: string, throughDate: string, db: Db = getDb()) {
  const [cards, purchases, installments, statements, payments] = await Promise.all([
    listCreditCards(householdId, db),
    db.select().from(creditCardPurchases).where(eq(creditCardPurchases.householdId, householdId)),
    listCardInstallments(householdId, undefined, db),
    listCardStatements(householdId, undefined, db),
    listCardPayments(householdId, undefined, db),
  ]);

  const purchaseById = new Map(purchases.map((item) => [item.id, item]));
  const paidByStatement = new Map<string, Cents>();
  for (const payment of payments) {
    paidByStatement.set(
      payment.statementId,
      addCents(paidByStatement.get(payment.statementId) ?? ZERO_CENTS, payment.amountCents),
    );
  }

  const statementViews = statements.map((statement) => {
    const active = installments.filter(
      (item) => item.statementId === statement.id && purchaseById.get(item.purchaseId)?.status === "ACTIVE",
    );
    const totalCents = addCents(...active.map((item) => item.amountCents));
    const paidCents = paidByStatement.get(statement.id) ?? ZERO_CENTS;
    const pendingCents = statementPendingCents(totalCents, paidCents);
    const status = deriveStatementStatus({
      today: todayInSaoPaulo(),
      closingDate: statement.closingDate,
      totalCents,
      paidCents,
      cancelled: statement.status === "CANCELLED",
    });

    return { ...statement, totalCents, paidCents, pendingCents, status };
  });

  const usedByCardId = new Map<string, Cents>();
  for (const card of cards) {
    const activeInstallmentCents = addCents(
      ...installments
        .filter(
          (item) =>
            item.creditCardId === card.id && purchaseById.get(item.purchaseId)?.status === "ACTIVE",
        )
        .map((item) => item.amountCents),
    );
    const statementIds = new Set(statements.filter((item) => item.creditCardId === card.id).map((item) => item.id));
    const validPaymentCents = addCents(
      ...payments.filter((item) => statementIds.has(item.statementId)).map((item) => item.amountCents),
    );
    usedByCardId.set(card.id, cardUsedLimitCents(activeInstallmentCents, validPaymentCents));
  }

  const usedCents = addCents(...[...usedByCardId.values()]);
  const limitCents = addCents(...cards.filter((card) => card.active).map((card) => card.limitCents));

  return {
    cards,
    purchases,
    installments,
    statements: statementViews,
    payments,
    usedCents,
    usedByCardId,
    availableLimitCents: cardAvailableLimitCents(limitCents, usedCents),
    limitCents,
    unpaidThroughMonthCents: unpaidStatementsThrough(statementViews, throughDate),
  };
}

export async function cardDetail(householdId: string, creditCardId: string, db: Db = getDb()) {
  const card = await getCreditCard(householdId, creditCardId, db);
  if (!card) {
    throw new ForbiddenError();
  }

  const state = await householdCardState(householdId, todayInSaoPaulo(), db);
  const statements = state.statements.filter((item) => item.creditCardId === card.id);
  const installments = state.installments.filter((item) => item.creditCardId === card.id);
  const purchases = state.purchases.filter((item) => item.creditCardId === card.id && !item.deletedAt);
  const usedCents = state.usedByCardId.get(card.id) ?? ZERO_CENTS;

  return {
    card,
    purchases,
    installments,
    statements,
    payments: state.payments.filter((payment) => statements.some((statement) => statement.id === payment.statementId)),
    usedCents,
    availableLimitCents: cardAvailableLimitCents(card.limitCents, usedCents),
  };
}
