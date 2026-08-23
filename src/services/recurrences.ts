import { and, eq, ne, sql } from "drizzle-orm";

import { getDb, type AppDatabase } from "@/db";
import { recurringRules, transactions } from "@/db/schema";
import { addMonths, compareIsoDate, occurrenceDate, occurrenceKey, parseYearMonth } from "@/lib/dates";
import { createId } from "@/lib/ids";
import type { Cents } from "@/types/money";

import { recordAudit } from "./audit";
import { assertHouseholdAccessForUser } from "./households";
import {
  createTransaction,
  getTransaction,
  LedgerError,
  setTransactionStatus,
  updateTransaction,
  validateLedgerWrite,
} from "./transactions";

type Db = AppDatabase;

export async function createRecurringRule(
  input: {
    userId: string;
    householdId: string;
    accountId: string;
    categoryId: string;
    assignedToUserId?: string | null;
    description: string;
    type: "INCOME" | "EXPENSE";
    amountCents: Cents;
    dueDay: number;
    startDate: string;
    endDate?: string | null;
    defaultStatus: "PLANNED" | "PENDING";
  },
  db: Db = getDb(),
) {
  await assertHouseholdAccessForUser(input.userId, input.householdId, db);
  await validateLedgerWrite(
    {
      householdId: input.householdId,
      type: input.type,
      amountCents: input.amountCents,
      accountId: input.accountId,
      categoryId: input.categoryId,
      assignedToUserId: input.assignedToUserId,
    },
    db,
  );

  const start = parseYearMonth(input.startDate.slice(0, 7));
  const firstDate = occurrenceDate(start.year, start.month, input.dueDay);
  const now = new Date();

  const [rule] = await db
    .insert(recurringRules)
    .values({
      id: createId(),
      householdId: input.householdId,
      accountId: input.accountId,
      categoryId: input.categoryId,
      assignedToUserId: input.assignedToUserId || null,
      description: input.description.trim(),
      type: input.type,
      amountCents: input.amountCents,
      frequency: "MONTHLY",
      dueDay: input.dueDay,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      nextOccurrenceDate: firstDate,
      defaultStatus: input.defaultStatus,
      active: true,
      createdByUserId: input.userId,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await recordAudit(
    {
      householdId: input.householdId,
      actorUserId: input.userId,
      action: "recurring.create",
      entityType: "recurring_rule",
      entityId: rule!.id,
      changedFields: ["amountCents", "dueDay"],
    },
    db,
  );

  return rule;
}

export async function updateRecurringRule(
  input: {
    userId: string;
    householdId: string;
    ruleId: string;
    description: string;
    amountCents: Cents;
    dueDay: number;
    accountId?: string;
    categoryId?: string;
    endDate?: string | null;
    defaultStatus: "PLANNED" | "PENDING";
    active?: boolean;
  },
  db: Db = getDb(),
) {
  await assertHouseholdAccessForUser(input.userId, input.householdId, db);

  const [existing] = await db
    .select()
    .from(recurringRules)
    .where(and(eq(recurringRules.id, input.ruleId), eq(recurringRules.householdId, input.householdId)))
    .limit(1);

  if (!existing) {
    throw new Error("RULE_NOT_FOUND");
  }

  const next = parseYearMonth(existing.nextOccurrenceDate.slice(0, 7));

  const [rule] = await db
    .update(recurringRules)
    .set({
      description: input.description.trim(),
      amountCents: input.amountCents,
      dueDay: input.dueDay,
      accountId: input.accountId ?? existing.accountId,
      categoryId: input.categoryId ?? existing.categoryId,
      endDate: input.endDate ?? null,
      defaultStatus: input.defaultStatus,
      active: input.active ?? existing.active,
      nextOccurrenceDate: occurrenceDate(next.year, next.month, input.dueDay),
      updatedAt: new Date(),
    })
    .where(eq(recurringRules.id, existing.id))
    .returning();

  await recordAudit(
    {
      householdId: input.householdId,
      actorUserId: input.userId,
      action: input.active === false ? "recurring.deactivate" : "recurring.update",
      entityType: "recurring_rule",
      entityId: existing.id,
      changedFields: ["description", "amountCents", "dueDay", "active"],
    },
    db,
  );

  return rule;
}

export async function listRecurringRules(householdId: string, db: Db = getDb()) {
  return db.select().from(recurringRules).where(eq(recurringRules.householdId, householdId));
}

export function shouldGenerateOccurrence(input: {
  startDate: string;
  endDate: string | null;
  occurrenceDate: string;
  active: boolean;
}) {
  if (!input.active) {
    return false;
  }

  if (input.occurrenceDate.slice(0, 7) < input.startDate.slice(0, 7)) {
    return false;
  }

  if (input.endDate && compareIsoDate(input.occurrenceDate, input.endDate) > 0) {
    return false;
  }

  return true;
}

export async function materializeRecurrencesForMonth(
  input: { userId: string; householdId: string; year: number; month: number },
  db: Db = getDb(),
) {
  await assertHouseholdAccessForUser(input.userId, input.householdId, db);
  const rules = await db
    .select()
    .from(recurringRules)
    .where(eq(recurringRules.householdId, input.householdId));

  let created = 0;

  for (const rule of rules) {
    const date = occurrenceDate(input.year, input.month, rule.dueDay);
    if (
      !shouldGenerateOccurrence({
        startDate: rule.startDate,
        endDate: rule.endDate,
        occurrenceDate: date,
        active: rule.active,
      })
    ) {
      continue;
    }

    const key = occurrenceKey(input.year, input.month);
    const already = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        and(
          eq(transactions.householdId, input.householdId),
          eq(transactions.recurringRuleId, rule.id),
          eq(transactions.recurrenceOccurrenceKey, key),
        ),
      )
      .limit(1);

    if (already[0]) {
      continue;
    }

    const inserted = await createTransaction(
      {
        userId: input.userId,
        householdId: input.householdId,
        type: rule.type as "INCOME" | "EXPENSE",
        description: rule.description,
        amountCents: rule.amountCents,
        accountId: rule.accountId,
        categoryId: rule.categoryId,
        assignedToUserId: rule.assignedToUserId,
        transactionDate: date,
        dueDate: date,
        status: rule.defaultStatus as "PLANNED" | "PENDING",
        recurringRuleId: rule.id,
        recurrenceOccurrenceKey: key,
      },
      db,
    );

    if (inserted) {
      created += 1;
    }

    const next = addMonths(input.year, input.month, 1);
    const nextDate = occurrenceDate(next.year, next.month, rule.dueDay);
    await db
      .update(recurringRules)
      .set({ nextOccurrenceDate: nextDate, updatedAt: new Date() })
      .where(eq(recurringRules.id, rule.id));
  }

  return created;
}

export async function updateRecurringOccurrence(
  input: {
    userId: string;
    householdId: string;
    transactionId: string;
    description: string;
    amountCents: Cents;
    accountId: string;
    categoryId?: string | null;
    transactionDate: string;
    dueDate?: string | null;
    type: "INCOME" | "EXPENSE";
    status: "PLANNED" | "PENDING" | "PAID";
    scope: "THIS" | "THIS_AND_FUTURE";
  },
  db: Db = getDb(),
) {
  const existing = await getTransaction(input.householdId, input.transactionId, db);
  if (!existing || existing.deletedAt) {
    throw new LedgerError("Movimentação não encontrada.", "NOT_FOUND");
  }

  const status =
    existing.status === "PAID" || existing.status === "PENDING" || existing.status === "PLANNED"
      ? (existing.status as "PLANNED" | "PENDING" | "PAID")
      : input.status;

  await updateTransaction(
    {
      userId: input.userId,
      householdId: input.householdId,
      transactionId: existing.id,
      type: input.type,
      description: input.description,
      amountCents: input.amountCents,
      accountId: input.accountId,
      destinationAccountId: existing.destinationAccountId,
      categoryId: input.categoryId,
      assignedToUserId: existing.assignedToUserId,
      transactionDate: input.transactionDate,
      dueDate: input.dueDate,
      status,
      notes: existing.notes,
    },
    db,
  );

  if (input.scope !== "THIS_AND_FUTURE" || !existing.recurringRuleId) {
    return;
  }

  const [rule] = await db
    .select()
    .from(recurringRules)
    .where(and(eq(recurringRules.id, existing.recurringRuleId), eq(recurringRules.householdId, input.householdId)))
    .limit(1);

  if (!rule) {
    return;
  }

  const dueDay = Number((input.dueDate || input.transactionDate).slice(8, 10));
  const competence = existing.dueDate ?? existing.transactionDate;

  await updateRecurringRule(
    {
      userId: input.userId,
      householdId: input.householdId,
      ruleId: rule.id,
      description: input.description,
      amountCents: input.amountCents,
      dueDay,
      accountId: input.accountId,
      categoryId: input.categoryId ?? rule.categoryId,
      endDate: rule.endDate,
      defaultStatus: rule.defaultStatus === "PENDING" ? "PENDING" : "PLANNED",
    },
    db,
  );

  const siblings = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.householdId, input.householdId),
        eq(transactions.recurringRuleId, rule.id),
        ne(transactions.id, existing.id),
        sql`${transactions.deletedAt} is null`,
      ),
    );

  for (const sibling of siblings) {
    const siblingDate = sibling.dueDate ?? sibling.transactionDate;
    if (siblingDate < competence) {
      continue;
    }

    if (sibling.status === "PAID" || sibling.status === "CANCELLED") {
      continue;
    }

    const period = parseYearMonth(siblingDate.slice(0, 7));
    const nextDate = occurrenceDate(period.year, period.month, dueDay);

    await updateTransaction(
      {
        userId: input.userId,
        householdId: input.householdId,
        transactionId: sibling.id,
        type: sibling.type as "INCOME" | "EXPENSE",
        description: input.description,
        amountCents: input.amountCents,
        accountId: input.accountId,
        destinationAccountId: sibling.destinationAccountId,
        categoryId: input.categoryId,
        assignedToUserId: sibling.assignedToUserId,
        transactionDate: nextDate,
        dueDate: nextDate,
        status: sibling.status === "PENDING" ? "PENDING" : "PLANNED",
        notes: sibling.notes,
      },
      db,
    );
  }
}

export async function deleteRecurringOccurrence(
  input: {
    userId: string;
    householdId: string;
    transactionId: string;
    scope: "THIS" | "THIS_AND_FUTURE";
  },
  db: Db = getDb(),
) {
  const existing = await getTransaction(input.householdId, input.transactionId, db);
  if (!existing || existing.deletedAt) {
    throw new LedgerError("Movimentação não encontrada.", "NOT_FOUND");
  }

  await setTransactionStatus(
    {
      userId: input.userId,
      householdId: input.householdId,
      transactionId: existing.id,
      status: "CANCELLED",
      softDelete: true,
    },
    db,
  );

  if (input.scope !== "THIS_AND_FUTURE" || !existing.recurringRuleId) {
    return;
  }

  const [rule] = await db
    .select()
    .from(recurringRules)
    .where(and(eq(recurringRules.id, existing.recurringRuleId), eq(recurringRules.householdId, input.householdId)))
    .limit(1);

  if (!rule) {
    return;
  }

  const competence = existing.dueDate ?? existing.transactionDate;

  await updateRecurringRule(
    {
      userId: input.userId,
      householdId: input.householdId,
      ruleId: rule.id,
      description: rule.description,
      amountCents: rule.amountCents,
      dueDay: rule.dueDay,
      endDate: competence,
      defaultStatus: rule.defaultStatus === "PENDING" ? "PENDING" : "PLANNED",
    },
    db,
  );

  const siblings = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.householdId, input.householdId),
        eq(transactions.recurringRuleId, rule.id),
        ne(transactions.id, existing.id),
        sql`${transactions.deletedAt} is null`,
      ),
    );

  for (const sibling of siblings) {
    const siblingDate = sibling.dueDate ?? sibling.transactionDate;
    if (siblingDate < competence || sibling.status === "PAID") {
      continue;
    }

    await setTransactionStatus(
      {
        userId: input.userId,
        householdId: input.householdId,
        transactionId: sibling.id,
        status: "CANCELLED",
        softDelete: true,
      },
      db,
    );
  }
}
