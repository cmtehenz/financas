import { and, eq } from "drizzle-orm";

import { getDb, type AppDatabase } from "@/db";
import { categories, categoryBudgets, monthlyBudgets } from "@/db/schema";
import { ForbiddenError } from "@/lib/access";
import { createId } from "@/lib/ids";
import type { Cents } from "@/types/money";

import { recordAudit } from "./audit";
import { assertHouseholdAccessForUser } from "./households";

type Db = AppDatabase;

export async function upsertMonthlyBudget(
  input: {
    userId: string;
    householdId: string;
    year: number;
    month: number;
    expectedIncomeCents: Cents;
    plannedInvestmentCents: Cents;
    notes?: string | null;
  },
  db: Db = getDb(),
) {
  await assertHouseholdAccessForUser(input.userId, input.householdId, db);

  if (input.expectedIncomeCents < BigInt(0) || input.plannedInvestmentCents < BigInt(0)) {
    throw new Error("BUDGET_NEGATIVE");
  }

  const now = new Date();
  const [existing] = await db
    .select()
    .from(monthlyBudgets)
    .where(
      and(
        eq(monthlyBudgets.householdId, input.householdId),
        eq(monthlyBudgets.year, input.year),
        eq(monthlyBudgets.month, input.month),
      ),
    )
    .limit(1);

  const row = existing
    ? (
        await db
          .update(monthlyBudgets)
          .set({
            expectedIncomeCents: input.expectedIncomeCents,
            plannedInvestmentCents: input.plannedInvestmentCents,
            notes: input.notes ?? null,
            updatedAt: now,
          })
          .where(eq(monthlyBudgets.id, existing.id))
          .returning()
      )[0]
    : (
        await db
          .insert(monthlyBudgets)
          .values({
            id: createId(),
            householdId: input.householdId,
            year: input.year,
            month: input.month,
            expectedIncomeCents: input.expectedIncomeCents,
            plannedInvestmentCents: input.plannedInvestmentCents,
            notes: input.notes ?? null,
            createdAt: now,
            updatedAt: now,
          })
          .returning()
      )[0];

  await recordAudit(
    {
      householdId: input.householdId,
      actorUserId: input.userId,
      action: existing ? "budget.update" : "budget.create",
      entityType: "monthly_budget",
      entityId: row!.id,
      changedFields: ["expectedIncomeCents", "plannedInvestmentCents"],
    },
    db,
  );

  return row;
}

export async function upsertCategoryLimit(
  input: {
    userId: string;
    householdId: string;
    monthlyBudgetId: string;
    categoryId: string;
    limitCents: Cents;
  },
  db: Db = getDb(),
) {
  await assertHouseholdAccessForUser(input.userId, input.householdId, db);

  if (input.limitCents < BigInt(0)) {
    throw new Error("BUDGET_NEGATIVE");
  }

  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, input.categoryId), eq(categories.householdId, input.householdId)))
    .limit(1);

  if (!category) {
    throw new ForbiddenError();
  }

  if (category.type !== "EXPENSE") {
    throw new Error("CATEGORY_NOT_EXPENSE");
  }

  const [budget] = await db
    .select()
    .from(monthlyBudgets)
    .where(and(eq(monthlyBudgets.id, input.monthlyBudgetId), eq(monthlyBudgets.householdId, input.householdId)))
    .limit(1);

  if (!budget) {
    throw new ForbiddenError();
  }

  const now = new Date();
  const [existing] = await db
    .select()
    .from(categoryBudgets)
    .where(
      and(eq(categoryBudgets.monthlyBudgetId, budget.id), eq(categoryBudgets.categoryId, input.categoryId)),
    )
    .limit(1);

  const row = existing
    ? (
        await db
          .update(categoryBudgets)
          .set({ limitCents: input.limitCents, updatedAt: now })
          .where(eq(categoryBudgets.id, existing.id))
          .returning()
      )[0]
    : (
        await db
          .insert(categoryBudgets)
          .values({
            id: createId(),
            monthlyBudgetId: budget.id,
            categoryId: input.categoryId,
            limitCents: input.limitCents,
            createdAt: now,
            updatedAt: now,
          })
          .returning()
      )[0];

  await recordAudit(
    {
      householdId: input.householdId,
      actorUserId: input.userId,
      action: "budget.category",
      entityType: "category_budget",
      entityId: row!.id,
      changedFields: ["limitCents"],
    },
    db,
  );

  return row;
}

export async function getMonthlyBudget(householdId: string, year: number, month: number, db: Db = getDb()) {
  const [budget] = await db
    .select()
    .from(monthlyBudgets)
    .where(
      and(
        eq(monthlyBudgets.householdId, householdId),
        eq(monthlyBudgets.year, year),
        eq(monthlyBudgets.month, month),
      ),
    )
    .limit(1);

  if (!budget) {
    return { budget: null, limits: [] as Array<typeof categoryBudgets.$inferSelect> };
  }

  const limits = await db
    .select()
    .from(categoryBudgets)
    .where(eq(categoryBudgets.monthlyBudgetId, budget.id));

  return { budget, limits };
}
