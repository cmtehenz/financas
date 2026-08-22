import { inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { closeDb, getDb } from "@/db";
import { households } from "@/db/schema";
import { user } from "@/db/schema/auth";
import { ForbiddenError } from "@/lib/access";
import { createFinancialAccount } from "@/services/accounts";
import { createHouseholdForUser } from "@/services/households";
import { listHouseholdCategories } from "@/services/categories";
import { materializeRecurrencesForMonth, createRecurringRule } from "@/services/recurrences";
import {
  createTransaction,
  LedgerError,
  listAllHouseholdTransactions,
  setTransactionStatus,
} from "@/services/transactions";
import { currentAccountBalance, currentHouseholdBalance } from "@/domain/ledger";

const db = getDb();
const createdUserIds: string[] = [];
const createdHouseholdIds: string[] = [];

async function insertUser(name: string) {
  const id = crypto.randomUUID();
  const email = `vitest-p3-${id}@example.test`;
  await db.insert(user).values({ id, name, email, emailVerified: true });
  createdUserIds.push(id);
  return { id, email, name };
}

describe.sequential("ledger isolation", { timeout: 30_000 }, () => {
  afterAll(async () => {
    if (createdHouseholdIds.length > 0) {
      await db.delete(households).where(inArray(households.id, createdHouseholdIds));
    }

    if (createdUserIds.length > 0) {
      await db.delete(user).where(inArray(user.id, createdUserIds));
    }

    await closeDb();
  });

  it("rejects foreign accounts, categories and members and does not duplicate recurrences", async () => {
    const ownerA = await insertUser("Owner A");
    const ownerB = await insertUser("Owner B");
    const houseA = await createHouseholdForUser({ userId: ownerA.id, name: "Casa Ledger A" });
    const houseB = await createHouseholdForUser({ userId: ownerB.id, name: "Casa Ledger B" });
    createdHouseholdIds.push(houseA.household.id, houseB.household.id);

    const accountA = await createFinancialAccount({
      userId: ownerA.id,
      householdId: houseA.household.id,
      name: "Caixa A",
      type: "CASH",
      openingBalanceCents: BigInt(10_000),
      openingBalanceDate: "2026-08-01",
    });
    const accountB = await createFinancialAccount({
      userId: ownerB.id,
      householdId: houseB.household.id,
      name: "Caixa B",
      type: "CASH",
      openingBalanceCents: BigInt(10_000),
      openingBalanceDate: "2026-08-01",
    });
    const catsA = await listHouseholdCategories(houseA.household.id);
    const catsB = await listHouseholdCategories(houseB.household.id);
    const salary = catsA.find((item) => item.slug === "salario")!;
    const mercadoB = catsB.find((item) => item.slug === "mercado")!;

    await expect(
      createTransaction({
        userId: ownerA.id,
        householdId: houseA.household.id,
        type: "EXPENSE",
        description: "Categoria incompatível",
        amountCents: BigInt(100),
        accountId: accountA!.id,
        categoryId: salary.id,
        transactionDate: "2026-08-10",
        status: "PAID",
      }),
    ).rejects.toMatchObject({ code: "CATEGORY_MISMATCH" });

    await expect(
      createTransaction({
        userId: ownerA.id,
        householdId: houseA.household.id,
        type: "EXPENSE",
        description: "Conta alheia",
        amountCents: BigInt(100),
        accountId: accountB!.id,
        categoryId: salary.id,
        transactionDate: "2026-08-10",
        status: "PAID",
      }),
    ).rejects.toBeInstanceOf(LedgerError);

    await expect(
      createTransaction({
        userId: ownerA.id,
        householdId: houseA.household.id,
        type: "EXPENSE",
        description: "Categoria alheia",
        amountCents: BigInt(100),
        accountId: accountA!.id,
        categoryId: mercadoB.id,
        transactionDate: "2026-08-10",
        status: "PAID",
      }),
    ).rejects.toBeInstanceOf(LedgerError);

    await expect(
      createTransaction({
        userId: ownerA.id,
        householdId: houseA.household.id,
        type: "INCOME",
        description: "Membro alheio",
        amountCents: BigInt(100),
        accountId: accountA!.id,
        categoryId: salary.id,
        assignedToUserId: ownerB.id,
        transactionDate: "2026-08-10",
        status: "PAID",
      }),
    ).rejects.toBeInstanceOf(LedgerError);

    await expect(createFinancialAccount({
      userId: ownerB.id,
      householdId: houseA.household.id,
      name: "Invasao",
      type: "CASH",
      openingBalanceCents: BigInt(1),
      openingBalanceDate: "2026-08-01",
    })).rejects.toBeInstanceOf(ForbiddenError);

    const income = await createTransaction({
      userId: ownerA.id,
      householdId: houseA.household.id,
      type: "INCOME",
      description: "Salario teste",
      amountCents: BigInt(5_000),
      accountId: accountA!.id,
      categoryId: salary.id,
      transactionDate: "2026-08-05",
      status: "PAID",
    });

    const ledgerAccount = {
      id: accountA!.id,
      openingBalanceCents: accountA!.openingBalanceCents,
      active: true,
    };
    const toLedger = async () =>
      (await listAllHouseholdTransactions(houseA.household.id)).map((item) => ({
        id: item.id,
        householdId: item.householdId,
        accountId: item.accountId,
        destinationAccountId: item.destinationAccountId,
        categoryId: item.categoryId,
        type: item.type as "INCOME" | "EXPENSE" | "TRANSFER",
        amountCents: item.amountCents,
        status: item.status as "PLANNED" | "PENDING" | "PAID" | "CANCELLED",
        transactionDate: item.transactionDate,
        dueDate: item.dueDate,
        paidAt: item.paidAt,
        deletedAt: item.deletedAt,
      }));

    expect(currentAccountBalance(ledgerAccount, await toLedger())).toBe(BigInt(15_000));

    await setTransactionStatus({
      userId: ownerA.id,
      householdId: houseA.household.id,
      transactionId: income!.id,
      status: "PENDING",
    });
    expect(currentAccountBalance(ledgerAccount, await toLedger())).toBe(BigInt(10_000));

    await setTransactionStatus({
      userId: ownerA.id,
      householdId: houseA.household.id,
      transactionId: income!.id,
      status: "PAID",
    });
    expect(currentAccountBalance(ledgerAccount, await toLedger())).toBe(BigInt(15_000));

    await setTransactionStatus({
      userId: ownerA.id,
      householdId: houseA.household.id,
      transactionId: income!.id,
      status: "CANCELLED",
    });

    const afterCancel = await toLedger();

    expect(currentAccountBalance(ledgerAccount, afterCancel)).toBe(BigInt(10_000));

    const mercado = catsA.find((item) => item.slug === "mercado")!;
    await createRecurringRule({
      userId: ownerA.id,
      householdId: houseA.household.id,
      accountId: accountA!.id,
      categoryId: mercado.id,
      description: "Mercado mensal",
      type: "EXPENSE",
      amountCents: BigInt(2_000),
      dueDay: 10,
      startDate: "2026-08-01",
      defaultStatus: "PENDING",
    });

    const first = await materializeRecurrencesForMonth({
      userId: ownerA.id,
      householdId: houseA.household.id,
      year: 2026,
      month: 8,
    });
    const second = await materializeRecurrencesForMonth({
      userId: ownerA.id,
      householdId: houseA.household.id,
      year: 2026,
      month: 8,
    });

    expect(first).toBe(1);
    expect(second).toBe(0);
    expect(currentHouseholdBalance([
      { id: accountA!.id, openingBalanceCents: accountA!.openingBalanceCents, active: true },
    ], afterCancel)).toBe(BigInt(10_000));
  });
});
