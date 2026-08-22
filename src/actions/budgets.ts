"use server";

import { ForbiddenError } from "@/lib/access";
import { toCents } from "@/lib/money";
import { requireHouseholdMembership } from "@/lib/require-household";
import { budgetSchema, categoryLimitsSchema } from "@/lib/validations/ledger";
import { getMonthlyBudget, upsertCategoryLimit, upsertMonthlyBudget } from "@/services/budgets";

export type ActionResult = { ok: true } | { ok: false; error: string };

function toError(error: unknown): ActionResult {
  if (error instanceof ForbiddenError) {
    return { ok: false, error: "Você não tem permissão para esta ação." };
  }

  if (error instanceof Error && error.message === "CATEGORY_NOT_EXPENSE") {
    return { ok: false, error: "Somente categorias de despesa recebem limite." };
  }

  return { ok: false, error: "Não foi possível salvar o orçamento." };
}

export async function upsertBudgetAction(input: unknown): Promise<ActionResult> {
  const parsed = budgetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const { session, household } = await requireHouseholdMembership();
    await upsertMonthlyBudget({
      userId: session.user.id,
      householdId: household.id,
      year: parsed.data.year,
      month: parsed.data.month,
      expectedIncomeCents: parsed.data.expectedIncomeCents,
      plannedInvestmentCents: parsed.data.plannedInvestmentCents,
      notes: parsed.data.notes,
    });
    return { ok: true };
  } catch (error) {
    return toError(error);
  }
}

export async function upsertCategoryLimitsAction(input: unknown): Promise<ActionResult> {
  const parsed = categoryLimitsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const { session, household } = await requireHouseholdMembership();
    const existing = await getMonthlyBudget(household.id, parsed.data.year, parsed.data.month);
    const budget =
      existing.budget ??
      (await upsertMonthlyBudget({
        userId: session.user.id,
        householdId: household.id,
        year: parsed.data.year,
        month: parsed.data.month,
        expectedIncomeCents: BigInt(0),
        plannedInvestmentCents: BigInt(0),
      }));

    if (!budget) {
      return { ok: false, error: "Não foi possível preparar o orçamento." };
    }

    for (const limit of parsed.data.limits) {
      const limitCents = toCents(limit.limit || "0");
      const already = existing.limits.some((item) => item.categoryId === limit.categoryId);
      if (limitCents === BigInt(0) && !already) {
        continue;
      }

      await upsertCategoryLimit({
        userId: session.user.id,
        householdId: household.id,
        monthlyBudgetId: budget.id,
        categoryId: limit.categoryId,
        limitCents,
      });
    }

    return { ok: true };
  } catch (error) {
    return toError(error);
  }
}
