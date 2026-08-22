import { and, eq, sql } from "drizzle-orm";

import { getDb, type AppDatabase } from "@/db";
import { financialAccounts } from "@/db/schema";
import type { FinancialAccountType } from "@/domain/account-types";
import { createId } from "@/lib/ids";
import type { Cents } from "@/types/money";

import { assertHouseholdAccessForUser, requireHouseholdOwnerRecord } from "./households";

type Db = AppDatabase;

export type FinancialAccountRecord = typeof financialAccounts.$inferSelect;

export async function listHouseholdAccounts(householdId: string, db: Db = getDb()) {
  return db
    .select()
    .from(financialAccounts)
    .where(
      and(eq(financialAccounts.householdId, householdId), sql`${financialAccounts.deletedAt} is null`),
    );
}

export async function createFinancialAccount(
  input: {
    userId: string;
    householdId: string;
    name: string;
    institutionName?: string;
    type: FinancialAccountType;
    openingBalanceCents: Cents;
    openingBalanceDate: string;
  },
  db: Db = getDb(),
) {
  await requireHouseholdOwnerRecord(input.userId, input.householdId, db);

  const now = new Date();
  const [account] = await db
    .insert(financialAccounts)
    .values({
      id: createId(),
      householdId: input.householdId,
      name: input.name,
      institutionName: input.institutionName,
      type: input.type,
      openingBalanceCents: input.openingBalanceCents,
      openingBalanceDate: input.openingBalanceDate,
      currency: "BRL",
      connectionType: "MANUAL",
      active: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return account;
}

export async function updateFinancialAccount(
  input: {
    userId: string;
    householdId: string;
    accountId: string;
    name: string;
    institutionName?: string;
    type: FinancialAccountType;
    openingBalanceCents: Cents;
    openingBalanceDate: string;
  },
  db: Db = getDb(),
) {
  await requireHouseholdOwnerRecord(input.userId, input.householdId, db);

  const [account] = await db
    .update(financialAccounts)
    .set({
      name: input.name,
      institutionName: input.institutionName ?? null,
      type: input.type,
      openingBalanceCents: input.openingBalanceCents,
      openingBalanceDate: input.openingBalanceDate,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(financialAccounts.id, input.accountId),
        eq(financialAccounts.householdId, input.householdId),
        sql`${financialAccounts.deletedAt} is null`,
      ),
    )
    .returning();

  return account;
}

export async function deactivateFinancialAccount(
  input: { userId: string; householdId: string; accountId: string },
  db: Db = getDb(),
) {
  await requireHouseholdOwnerRecord(input.userId, input.householdId, db);

  const [account] = await db
    .update(financialAccounts)
    .set({
      active: false,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(financialAccounts.id, input.accountId),
        eq(financialAccounts.householdId, input.householdId),
        sql`${financialAccounts.deletedAt} is null`,
      ),
    )
    .returning();

  return account;
}

export async function listAccessibleHouseholdAccounts(
  userId: string,
  householdId: string,
  db: Db = getDb(),
) {
  await assertHouseholdAccessForUser(userId, householdId, db);
  return listHouseholdAccounts(householdId, db);
}
