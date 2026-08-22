"use server";

import { ForbiddenError } from "@/lib/access";
import { requireHouseholdMembership } from "@/lib/require-household";
import {
  categoryFormSchema,
  deactivateCategorySchema,
  updateCategorySchema,
} from "@/lib/validations/ledger";
import { createCategory, deactivateCategory, updateCategory } from "@/services/categories";
import { recordAudit } from "@/services/audit";

export type ActionResult = { ok: true } | { ok: false; error: string };

function toError(error: unknown): ActionResult {
  if (error instanceof ForbiddenError) {
    return { ok: false, error: "Você não tem permissão para esta ação." };
  }

  if (error instanceof Error && error.message === "CATEGORY_EXISTS") {
    return { ok: false, error: "Já existe uma categoria com esse nome." };
  }

  return { ok: false, error: "Não foi possível salvar a categoria." };
}

export async function createCategoryAction(input: unknown): Promise<ActionResult> {
  const parsed = categoryFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const { session, household } = await requireHouseholdMembership();
    const category = await createCategory({
      userId: session.user.id,
      householdId: household.id,
      ...parsed.data,
    });
    await recordAudit({
      householdId: household.id,
      actorUserId: session.user.id,
      action: "category.create",
      entityType: "category",
      entityId: category.id,
      changedFields: ["name", "type"],
    });
    return { ok: true };
  } catch (error) {
    return toError(error);
  }
}

export async function updateCategoryAction(input: unknown): Promise<ActionResult> {
  const parsed = updateCategorySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const { session, household } = await requireHouseholdMembership();
    await updateCategory({
      userId: session.user.id,
      householdId: household.id,
      ...parsed.data,
    });
    await recordAudit({
      householdId: household.id,
      actorUserId: session.user.id,
      action: "category.update",
      entityType: "category",
      entityId: parsed.data.categoryId,
      changedFields: ["name", "type", "kind"],
    });
    return { ok: true };
  } catch (error) {
    return toError(error);
  }
}

export async function deactivateCategoryAction(input: unknown): Promise<ActionResult> {
  const parsed = deactivateCategorySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Categoria inválida." };
  }

  try {
    const { session, household } = await requireHouseholdMembership();
    await deactivateCategory({
      userId: session.user.id,
      householdId: household.id,
      categoryId: parsed.data.categoryId,
    });
    await recordAudit({
      householdId: household.id,
      actorUserId: session.user.id,
      action: "category.deactivate",
      entityType: "category",
      entityId: parsed.data.categoryId,
      changedFields: ["active"],
    });
    return { ok: true };
  } catch (error) {
    return toError(error);
  }
}
