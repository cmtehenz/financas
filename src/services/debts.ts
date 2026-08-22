import { and, eq, sql } from "drizzle-orm";

import { getDb, type DbClient } from "@/db";
import { categories, debtInstallments, debts } from "@/db/schema";
import { buildDebtSchedule, debtOutstandingFromSchedule, deriveDebtStatus } from "@/domain/debts";
import { ZERO_CENTS } from "@/domain/ledger";
import { todayInSaoPaulo } from "@/lib/dates";
import { createId, isUuid } from "@/lib/ids";
import { addCents } from "@/lib/money";
import type { Cents } from "@/types/money";

import { recordAudit } from "./audit";
import { assertHouseholdAccessForUser } from "./households";
import { createTransaction, LedgerError } from "./transactions";

type Db = DbClient;

export class DebtError extends Error {
  constructor(
    message: string,
    readonly code: "FOREIGN_DEBT" | "ALREADY_PAID" | "NOT_FOUND" | "INVALID_DEBT",
  ) {
    super(message);
    this.name = "DebtError";
  }
}

export async function createDebt(
  input: {
    userId: string;
    householdId: string;
    name: string;
    creditor: string;
    categoryId: string;
    originalAmountCents: Cents;
    outstandingBalanceCents: Cents;
    installmentAmountCents?: Cents | null;
    totalInstallments?: number | null;
    annualInterestRateBasisPoints?: number | null;
    firstDueDate: string;
    notes?: string | null;
  },
  db: Db = getDb(),
) {
  await assertHouseholdAccessForUser(input.userId, input.householdId, db);

  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, input.categoryId), eq(categories.householdId, input.householdId)))
    .limit(1);

  if (!category || category.type !== "EXPENSE" || category.kind !== "DEBT") {
    throw new LedgerError("Use uma categoria de dívida desta Casa.", "CATEGORY_MISMATCH");
  }

  const installmentCount = input.totalInstallments && input.totalInstallments > 0 ? input.totalInstallments : 1;
  const scheduleTotal =
    input.outstandingBalanceCents > ZERO_CENTS ? input.outstandingBalanceCents : input.originalAmountCents;
  const schedule = buildDebtSchedule({
    firstDueDate: input.firstDueDate,
    installmentCount,
    totalCents: scheduleTotal,
    today: todayInSaoPaulo(),
  });

  const debtId = createId();
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(debts).values({
      id: debtId,
      householdId: input.householdId,
      name: input.name.trim(),
      creditor: input.creditor.trim(),
      categoryId: input.categoryId,
      originalAmountCents: input.originalAmountCents,
      outstandingBalanceCents: scheduleTotal,
      installmentAmountCents: input.installmentAmountCents ?? schedule[0]?.amountCents ?? null,
      totalInstallments: installmentCount,
      paidInstallments: 0,
      annualInterestRateBasisPoints: input.annualInterestRateBasisPoints ?? null,
      firstDueDate: input.firstDueDate,
      status: "ACTIVE",
      notes: input.notes || null,
      createdByUserId: input.userId,
      createdAt: now,
      updatedAt: now,
    });

    for (const item of schedule) {
      await tx.insert(debtInstallments).values({
        id: createId(),
        householdId: input.householdId,
        debtId,
        installmentNumber: item.installmentNumber,
        dueDate: item.dueDate,
        amountCents: item.amountCents,
        status: item.status,
        createdAt: now,
        updatedAt: now,
      });
    }

    await recordAudit(
      {
        householdId: input.householdId,
        actorUserId: input.userId,
        action: "debt.create",
        entityType: "debt",
        entityId: debtId,
        changedFields: ["name", "outstandingBalanceCents"],
      },
      tx,
    );
  });

  return getDebt(input.householdId, debtId, db);
}

export async function getDebt(householdId: string, debtId: string, db: Db = getDb()) {
  if (!isUuid(debtId)) {
    return null;
  }

  const [debt] = await db
    .select()
    .from(debts)
    .where(and(eq(debts.id, debtId), eq(debts.householdId, householdId)))
    .limit(1);

  return debt && !debt.deletedAt ? debt : null;
}

export async function listDebts(householdId: string, db: Db = getDb()) {
  return db.select().from(debts).where(and(eq(debts.householdId, householdId), sql`${debts.deletedAt} is null`));
}

export async function listDebtInstallments(householdId: string, debtId?: string, db: Db = getDb()) {
  if (debtId) {
    return db
      .select()
      .from(debtInstallments)
      .where(and(eq(debtInstallments.householdId, householdId), eq(debtInstallments.debtId, debtId)));
  }

  return db.select().from(debtInstallments).where(eq(debtInstallments.householdId, householdId));
}

export function pendingDebtThrough(
  installments: Array<{ amountCents: Cents; dueDate: string; status: string }>,
  throughDate: string,
): Cents {
  return addCents(
    ...installments
      .filter(
        (item) =>
          (item.status === "PENDING" || item.status === "OVERDUE") && item.dueDate <= throughDate,
      )
      .map((item) => item.amountCents),
  );
}

export async function updateDebtStatus(
  input: { userId: string; householdId: string; debtId: string; status: "NEGOTIATING" | "CANCELLED" | "ACTIVE" },
  db: Db = getDb(),
) {
  await assertHouseholdAccessForUser(input.userId, input.householdId, db);
  const debt = await getDebt(input.householdId, input.debtId, db);
  if (!debt) {
    throw new DebtError("A dívida não pertence a esta Casa.", "FOREIGN_DEBT");
  }

  const [row] = await db
    .update(debts)
    .set({ status: input.status, updatedAt: new Date() })
    .where(eq(debts.id, debt.id))
    .returning();

  await recordAudit(
    {
      householdId: input.householdId,
      actorUserId: input.userId,
      action: input.status === "NEGOTIATING" ? "debt.negotiate" : "debt.status",
      entityType: "debt",
      entityId: debt.id,
      changedFields: ["status"],
    },
    db,
  );

  return row;
}

export async function payDebtInstallment(
  input: {
    userId: string;
    householdId: string;
    debtId: string;
    installmentId: string;
    accountId: string;
  },
  db: Db = getDb(),
) {
  await assertHouseholdAccessForUser(input.userId, input.householdId, db);

  return db.transaction(async (tx) => {
    const debt = await getDebt(input.householdId, input.debtId, tx);
    if (!debt) {
      throw new DebtError("A dívida não pertence a esta Casa.", "FOREIGN_DEBT");
    }

    const [installment] = await tx
      .select()
      .from(debtInstallments)
      .where(
        and(
          eq(debtInstallments.id, input.installmentId),
          eq(debtInstallments.debtId, debt.id),
          eq(debtInstallments.householdId, input.householdId),
        ),
      )
      .limit(1);

    if (!installment) {
      throw new DebtError("Parcela não encontrada.", "NOT_FOUND");
    }

    if (installment.status === "PAID" || installment.paymentTransactionId) {
      throw new DebtError("Esta parcela já foi paga.", "ALREADY_PAID");
    }

    const transaction = await createTransaction(
      {
        userId: input.userId,
        householdId: input.householdId,
        type: "EXPENSE",
        description: `${debt.name} ${installment.installmentNumber}/${debt.totalInstallments ?? installment.installmentNumber}`,
        amountCents: installment.amountCents,
        accountId: input.accountId,
        categoryId: debt.categoryId,
        transactionDate: todayInSaoPaulo(),
        dueDate: installment.dueDate,
        status: "PAID",
        origin: "DEBT_PAYMENT",
        budgetImpact: true,
      },
      tx,
    );

    if (!transaction) {
      throw new DebtError("Não foi possível registrar o pagamento.", "INVALID_DEBT");
    }

    const now = new Date();
    await tx
      .update(debtInstallments)
      .set({
        status: "PAID",
        paymentTransactionId: transaction.id,
        paidAt: now,
        updatedAt: now,
      })
      .where(eq(debtInstallments.id, installment.id));

    const remaining = await tx.select().from(debtInstallments).where(eq(debtInstallments.debtId, debt.id));
    const outstanding = debtOutstandingFromSchedule(
      remaining.map((item) => ({
        amountCents: item.amountCents,
        status: (item.id === installment.id ? "PAID" : item.status) as "PENDING" | "PAID" | "OVERDUE" | "CANCELLED",
      })),
    );
    const paidCount = remaining.filter((item) => item.id === installment.id || item.status === "PAID").length;
    const status = deriveDebtStatus({ outstandingCents: outstanding });

    await tx
      .update(debts)
      .set({
        outstandingBalanceCents: outstanding,
        paidInstallments: paidCount,
        status,
        updatedAt: now,
      })
      .where(eq(debts.id, debt.id));

    await recordAudit(
      {
        householdId: input.householdId,
        actorUserId: input.userId,
        action: status === "PAID_OFF" ? "debt.payoff" : "debt.installment.pay",
        entityType: "debt",
        entityId: debt.id,
        changedFields: ["outstandingBalanceCents", "status"],
      },
      tx,
    );

    return { outstanding, status, transactionId: transaction.id };
  });
}

export async function householdDebtState(householdId: string, db: Db = getDb()) {
  const [rows, installments] = await Promise.all([
    listDebts(householdId, db),
    listDebtInstallments(householdId, undefined, db),
  ]);

  return {
    debts: rows,
    installments,
    outstandingCents: addCents(
      ...rows.filter((item) => item.status === "ACTIVE" || item.status === "NEGOTIATING").map((item) => item.outstandingBalanceCents),
    ),
  };
}
