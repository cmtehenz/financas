import { and, count, eq } from "drizzle-orm";

import { getDb, type AppDatabase } from "@/db";
import { categories, transactions } from "@/db/schema";
import { slugify } from "@/domain/transaction-types";
import { ForbiddenError } from "@/lib/access";
import { createId } from "@/lib/ids";

import { assertHouseholdAccessForUser } from "./households";

type Db = AppDatabase;

export async function listHouseholdCategories(householdId: string, db: Db = getDb()) {
  return db.select().from(categories).where(eq(categories.householdId, householdId));
}

export async function createCategory(
  input: {
    userId: string;
    householdId: string;
    name: string;
    type: "INCOME" | "EXPENSE";
    kind: "FIXED" | "VARIABLE" | "DEBT" | "INVESTMENT" | "OTHER";
    color?: string;
    icon?: string;
  },
  db: Db = getDb(),
) {
  await assertHouseholdAccessForUser(input.userId, input.householdId, db);
  const now = new Date();
  const slug = slugify(input.name);

  const [category] = await db
    .insert(categories)
    .values({
      id: createId(),
      householdId: input.householdId,
      name: input.name,
      slug,
      type: input.type,
      kind: input.kind,
      color: input.color ?? "#475569",
      icon: input.icon ?? "circle",
      active: true,
      systemDefault: false,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({
      target: [categories.householdId, categories.type, categories.slug],
    })
    .returning();

  if (!category) {
    throw new Error("CATEGORY_EXISTS");
  }

  return category;
}

export async function updateCategory(
  input: {
    userId: string;
    householdId: string;
    categoryId: string;
    name: string;
    type: "INCOME" | "EXPENSE";
    kind: "FIXED" | "VARIABLE" | "DEBT" | "INVESTMENT" | "OTHER";
    color?: string;
    icon?: string;
  },
  db: Db = getDb(),
) {
  await assertHouseholdAccessForUser(input.userId, input.householdId, db);

  const [category] = await db
    .update(categories)
    .set({
      name: input.name,
      slug: slugify(input.name),
      type: input.type,
      kind: input.kind,
      color: input.color ?? "#475569",
      icon: input.icon ?? "circle",
      updatedAt: new Date(),
    })
    .where(and(eq(categories.id, input.categoryId), eq(categories.householdId, input.householdId)))
    .returning();

  if (!category) {
    throw new ForbiddenError();
  }

  return category;
}

export async function deactivateCategory(
  input: { userId: string; householdId: string; categoryId: string },
  db: Db = getDb(),
) {
  await assertHouseholdAccessForUser(input.userId, input.householdId, db);

  const [used] = await db
    .select({ n: count() })
    .from(transactions)
    .where(eq(transactions.categoryId, input.categoryId));

  const [category] = await db
    .update(categories)
    .set({ active: false, updatedAt: new Date() })
    .where(and(eq(categories.id, input.categoryId), eq(categories.householdId, input.householdId)))
    .returning();

  if (!category) {
    throw new ForbiddenError();
  }

  return { category, usedInTransactions: (used?.n ?? 0) > 0 };
}
