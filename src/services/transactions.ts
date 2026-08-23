import { and, desc, eq, sql } from "drizzle-orm";

import { getDb, type DbClient } from "@/db";
import { categories, financialAccounts, householdMembers, transactions } from "@/db/schema";
import { normalizeDescription } from "@/domain/transaction-types";
import { dateInSaoPaulo } from "@/lib/dates";
import { createId, isUuid } from "@/lib/ids";
import type { Cents } from "@/types/money";

import { recordAudit } from "./audit";
import { assertHouseholdAccessForUser } from "./households";

type Db = DbClient;

export class LedgerError extends Error {
  constructor(
    message: string,
    readonly code:
      | "INVALID_AMOUNT"
      | "CATEGORY_REQUIRED"
      | "CATEGORY_MISMATCH"
      | "FOREIGN_CATEGORY"
      | "FOREIGN_ACCOUNT"
      | "INACTIVE_ACCOUNT"
      | "TRANSFER_ACCOUNTS"
      | "FOREIGN_MEMBER"
      | "NOT_FOUND"
      | "ALREADY_PAID"
      | "UNDEFINED_AMOUNT"
      | "INVALID_STATUS",
  ) {
    super(message);
    this.name = "LedgerError";
  }
}

type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER";
type TransactionStatus = "PLANNED" | "PENDING" | "PAID" | "CANCELLED";

async function requireActiveAccount(householdId: string, accountId: string, db: Db) {
  if (!accountId) {
    throw new LedgerError("Conta inválida.", "FOREIGN_ACCOUNT");
  }

  const [account] = await db
    .select()
    .from(financialAccounts)
    .where(and(eq(financialAccounts.id, accountId), eq(financialAccounts.householdId, householdId)))
    .limit(1);

  if (!account) {
    throw new LedgerError("A conta não pertence a esta Casa.", "FOREIGN_ACCOUNT");
  }

  if (!account.active || account.deletedAt) {
    throw new LedgerError("Conta desativada não recebe nova movimentação.", "INACTIVE_ACCOUNT");
  }

  return account;
}

async function requireCategory(
  householdId: string,
  categoryId: string,
  type: "INCOME" | "EXPENSE",
  db: Db,
) {
  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.householdId, householdId)))
    .limit(1);

  if (!category) {
    throw new LedgerError("A categoria não pertence a esta Casa.", "FOREIGN_CATEGORY");
  }

  if (category.type !== type) {
    throw new LedgerError("A categoria não combina com o tipo da movimentação.", "CATEGORY_MISMATCH");
  }

  return category;
}

async function requireMember(householdId: string, userId: string, db: Db) {
  const [member] = await db
    .select({ id: householdMembers.id })
    .from(householdMembers)
    .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)))
    .limit(1);

  if (!member) {
    throw new LedgerError("O responsável precisa ser membro desta Casa.", "FOREIGN_MEMBER");
  }
}

function paidAtForStatus(status: TransactionStatus, previousPaidAt?: Date | null) {
  if (status === "PAID") {
    return previousPaidAt ?? new Date();
  }

  return null;
}

function assertAmount(
  amountCents: Cents,
  options: { status?: TransactionStatus; type?: TransactionType; origin?: string } = {},
) {
  if (amountCents < BigInt(0)) {
    throw new LedgerError("O valor não pode ser negativo.", "INVALID_AMOUNT");
  }

  const allowsZero =
    (options.status === "PLANNED" || options.status === "PENDING") &&
    options.type !== "TRANSFER" &&
    options.origin !== "CARD_PAYMENT" &&
    options.origin !== "DEBT_PAYMENT";

  if (options.status === "PAID" && amountCents <= BigInt(0)) {
    throw new LedgerError("Pagamento exige valor maior que zero.", "UNDEFINED_AMOUNT");
  }

  if (amountCents === BigInt(0) && !allowsZero) {
    throw new LedgerError("O valor precisa ser maior que zero.", "INVALID_AMOUNT");
  }
}

export async function validateLedgerWrite(
  input: {
    householdId: string;
    type: TransactionType;
    amountCents: Cents;
    accountId: string;
    destinationAccountId?: string | null;
    categoryId?: string | null;
    assignedToUserId?: string | null;
    origin?: "MANUAL" | "CARD_PAYMENT" | "DEBT_PAYMENT";
    status?: TransactionStatus;
  },
  db: Db = getDb(),
) {
  assertAmount(input.amountCents, { status: input.status, type: input.type, origin: input.origin });
  const account = await requireActiveAccount(input.householdId, input.accountId, db);
  const origin = input.origin ?? "MANUAL";

  if (input.type === "TRANSFER") {
    if (!input.destinationAccountId || input.destinationAccountId === input.accountId) {
      throw new LedgerError("Informe uma conta de destino diferente.", "TRANSFER_ACCOUNTS");
    }

    if (input.categoryId) {
      throw new LedgerError("Transferência não utiliza categoria.", "CATEGORY_MISMATCH");
    }

    const destination = await requireActiveAccount(input.householdId, input.destinationAccountId, db);
    if (destination.householdId !== account.householdId) {
      throw new LedgerError("A conta de destino não pertence a esta Casa.", "FOREIGN_ACCOUNT");
    }
  } else {
    if (input.destinationAccountId) {
      throw new LedgerError("Somente transferência usa conta de destino.", "TRANSFER_ACCOUNTS");
    }

    if (origin === "CARD_PAYMENT") {
      if (input.categoryId) {
        throw new LedgerError("Pagamento de fatura não usa categoria de orçamento.", "CATEGORY_MISMATCH");
      }
    } else if (!input.categoryId) {
      throw new LedgerError("Receita e despesa exigem categoria.", "CATEGORY_REQUIRED");
    } else {
      await requireCategory(input.householdId, input.categoryId, input.type, db);
    }
  }

  if (input.assignedToUserId) {
    await requireMember(input.householdId, input.assignedToUserId, db);
  }
}

export async function createTransaction(
  input: {
    userId: string;
    householdId: string;
    type: TransactionType;
    description: string;
    amountCents: Cents;
    accountId: string;
    destinationAccountId?: string | null;
    categoryId?: string | null;
    assignedToUserId?: string | null;
    transactionDate: string;
    dueDate?: string | null;
    status: Exclude<TransactionStatus, "CANCELLED">;
    notes?: string | null;
    recurringRuleId?: string | null;
    recurrenceOccurrenceKey?: string | null;
    origin?: "MANUAL" | "CARD_PAYMENT" | "DEBT_PAYMENT";
    budgetImpact?: boolean;
    planningCopyKey?: string | null;
  },
  db: Db = getDb(),
) {
  await assertHouseholdAccessForUser(input.userId, input.householdId, db);
  const destinationAccountId = input.destinationAccountId || null;
  const categoryId = input.categoryId || null;
  const assignedToUserId = input.assignedToUserId || null;
  const origin = input.origin ?? "MANUAL";
  const budgetImpact = input.budgetImpact ?? origin !== "CARD_PAYMENT";
  await validateLedgerWrite({ ...input, destinationAccountId, categoryId, assignedToUserId, origin }, db);

  const now = new Date();
  const status = input.status;
  const [row] = await db
    .insert(transactions)
    .values({
      id: createId(),
      householdId: input.householdId,
      accountId: input.accountId,
      destinationAccountId: input.type === "TRANSFER" ? destinationAccountId : null,
      categoryId: input.type === "TRANSFER" ? null : categoryId,
      createdByUserId: input.userId,
      assignedToUserId,
      description: input.description.trim(),
      normalizedDescription: normalizeDescription(input.description),
      type: input.type,
      amountCents: input.amountCents,
      status,
      visibility: "HOUSEHOLD",
      origin,
      budgetImpact,
      transactionDate: input.transactionDate,
      dueDate: input.dueDate || null,
      paidAt: paidAtForStatus(status),
      notes: input.notes || null,
      recurringRuleId: input.recurringRuleId ?? null,
      recurrenceOccurrenceKey: input.recurrenceOccurrenceKey ?? null,
      planningCopyKey: input.planningCopyKey ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await recordAudit(
    {
      householdId: input.householdId,
      actorUserId: input.userId,
      action: "transaction.create",
      entityType: "transaction",
      entityId: row!.id,
      changedFields: ["status", "amountCents", "type"],
    },
    db,
  );

  return row ?? null;
}

export async function updateTransaction(
  input: {
    userId: string;
    householdId: string;
    transactionId: string;
    type: TransactionType;
    description: string;
    amountCents: Cents;
    accountId: string;
    destinationAccountId?: string | null;
    categoryId?: string | null;
    assignedToUserId?: string | null;
    transactionDate: string;
    dueDate?: string | null;
    status: Exclude<TransactionStatus, "CANCELLED">;
    notes?: string | null;
  },
  db: Db = getDb(),
) {
  await assertHouseholdAccessForUser(input.userId, input.householdId, db);
  const destinationAccountId = input.destinationAccountId || null;
  const categoryId = input.categoryId || null;
  const assignedToUserId = input.assignedToUserId || null;
  await validateLedgerWrite({ ...input, destinationAccountId, categoryId, assignedToUserId }, db);

  const [existing] = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.id, input.transactionId),
        eq(transactions.householdId, input.householdId),
        sql`${transactions.deletedAt} is null`,
      ),
    )
    .limit(1);

  if (!existing) {
    throw new LedgerError("Movimentação não encontrada.", "NOT_FOUND");
  }

  const [row] = await db
    .update(transactions)
    .set({
      type: input.type,
      description: input.description.trim(),
      normalizedDescription: normalizeDescription(input.description),
      amountCents: input.amountCents,
      accountId: input.accountId,
      destinationAccountId: input.type === "TRANSFER" ? destinationAccountId : null,
      categoryId: input.type === "TRANSFER" ? null : categoryId,
      assignedToUserId,
      transactionDate: input.transactionDate,
      dueDate: input.dueDate || null,
      status: input.status,
      paidAt: paidAtForStatus(input.status, existing.paidAt),
      notes: input.notes ?? null,
      updatedAt: new Date(),
    })
    .where(eq(transactions.id, existing.id))
    .returning();

  await recordAudit(
    {
      householdId: input.householdId,
      actorUserId: input.userId,
      action: "transaction.update",
      entityType: "transaction",
      entityId: existing.id,
      changedFields: ["description", "amountCents", "status", "accountId"],
    },
    db,
  );

  return row;
}

export async function setTransactionStatus(
  input: {
    userId: string;
    householdId: string;
    transactionId: string;
    status: TransactionStatus;
    softDelete?: boolean;
  },
  db: Db = getDb(),
) {
  await assertHouseholdAccessForUser(input.userId, input.householdId, db);

  const [existing] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, input.transactionId), eq(transactions.householdId, input.householdId)))
    .limit(1);

  if (!existing || existing.deletedAt) {
    throw new LedgerError("Movimentação não encontrada.", "NOT_FOUND");
  }

  if (input.status === "PAID" && existing.amountCents <= BigInt(0)) {
    throw new LedgerError("Informe o valor antes de marcar como paga.", "UNDEFINED_AMOUNT");
  }

  const [row] = await db
    .update(transactions)
    .set({
      status: input.status,
      paidAt: paidAtForStatus(input.status, existing.paidAt),
      deletedAt: input.softDelete ? new Date() : existing.deletedAt,
      updatedAt: new Date(),
    })
    .where(eq(transactions.id, existing.id))
    .returning();

  await recordAudit(
    {
      householdId: input.householdId,
      actorUserId: input.userId,
      action: input.softDelete
        ? "transaction.delete"
        : input.status === "CANCELLED"
          ? "transaction.cancel"
          : "transaction.status",
      entityType: "transaction",
      entityId: existing.id,
      changedFields: input.softDelete ? ["deletedAt"] : ["status", "paidAt"],
    },
    db,
  );

  return row;
}

export async function getTransaction(householdId: string, transactionId: string, db: Db = getDb()) {
  if (!isUuid(transactionId)) {
    return null;
  }

  const [row] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.householdId, householdId)))
    .limit(1);

  return row ?? null;
}

export async function listHouseholdTransactions(
  householdId: string,
  filters: {
    month?: string;
    accountId?: string;
    categoryId?: string;
    type?: TransactionType;
    status?: TransactionStatus;
    q?: string;
    page?: number;
    pageSize?: number;
  } = {},
  db: Db = getDb(),
) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const rows = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.householdId, householdId), sql`${transactions.deletedAt} is null`))
    .orderBy(desc(transactions.transactionDate), desc(transactions.createdAt));

  const filtered = rows.filter((item) => {
    if (filters.accountId && item.accountId !== filters.accountId && item.destinationAccountId !== filters.accountId) {
      return false;
    }

    if (filters.categoryId && item.categoryId !== filters.categoryId) {
      return false;
    }

    if (filters.type && item.type !== filters.type) {
      return false;
    }

    if (filters.status && item.status !== filters.status) {
      return false;
    }

    if (filters.q && !item.description.toLowerCase().includes(filters.q.toLowerCase())) {
      return false;
    }

    if (filters.month) {
      const paidDate = item.paidAt ? dateInSaoPaulo(item.paidAt) : null;
      const date =
        item.status === "PAID"
          ? (paidDate ?? item.transactionDate)
          : (item.dueDate ?? item.transactionDate);
      if (!date.startsWith(filters.month)) {
        return false;
      }
    }

    return true;
  });

  return {
    rows: filtered.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
  };
}

export async function listAllHouseholdTransactions(householdId: string, db: Db = getDb()) {
  return db
    .select()
    .from(transactions)
    .where(and(eq(transactions.householdId, householdId), sql`${transactions.deletedAt} is null`));
}

function paidAtFromIsoDate(paidAt: string) {
  return new Date(`${paidAt}T15:00:00.000-03:00`);
}

export async function settleLedgerPlanningItem(
  input: {
    userId: string;
    householdId: string;
    transactionId: string;
    amountCents: Cents;
    accountId: string;
    paidAt: string;
  },
  db: Db = getDb(),
) {
  await assertHouseholdAccessForUser(input.userId, input.householdId, db);

  const existing = await getTransaction(input.householdId, input.transactionId, db);
  if (!existing || existing.deletedAt) {
    throw new LedgerError("Movimentação não encontrada.", "NOT_FOUND");
  }

  if (existing.status === "PAID") {
    throw new LedgerError("Esta conta já foi paga.", "ALREADY_PAID");
  }

  if (existing.status === "CANCELLED") {
    throw new LedgerError("Conta cancelada não pode ser paga.", "INVALID_STATUS");
  }

  if (existing.type === "TRANSFER" || existing.origin === "CARD_PAYMENT" || existing.origin === "DEBT_PAYMENT") {
    throw new LedgerError("Use o fluxo original desta movimentação.", "INVALID_STATUS");
  }

  if (input.amountCents <= BigInt(0)) {
    throw new LedgerError("Informe um valor maior que zero para pagar.", "UNDEFINED_AMOUNT");
  }

  const type = existing.type as TransactionType;
  await validateLedgerWrite(
    {
      householdId: input.householdId,
      type,
      amountCents: input.amountCents,
      accountId: input.accountId,
      categoryId: existing.categoryId,
      assignedToUserId: existing.assignedToUserId,
      origin: existing.origin as "MANUAL" | "CARD_PAYMENT" | "DEBT_PAYMENT",
      status: "PAID",
    },
    db,
  );

  const [row] = await db
    .update(transactions)
    .set({
      amountCents: input.amountCents,
      accountId: input.accountId,
      status: "PAID",
      paidAt: paidAtFromIsoDate(input.paidAt),
      updatedAt: new Date(),
    })
    .where(and(eq(transactions.id, existing.id), eq(transactions.householdId, input.householdId)))
    .returning();

  await recordAudit(
    {
      householdId: input.householdId,
      actorUserId: input.userId,
      action: "transaction.pay",
      entityType: "transaction",
      entityId: existing.id,
      changedFields: ["status", "amountCents", "accountId", "paidAt"],
    },
    db,
  );

  return row;
}
