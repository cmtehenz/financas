import { inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { closeDb, getDb } from "@/db";
import { households } from "@/db/schema";
import { user } from "@/db/schema/auth";
import { ForbiddenError } from "@/lib/access";
import { requireTestDatabaseUrl } from "@/lib/test-database";
import { createFinancialAccount } from "@/services/accounts";
import { createCreditCard, createCardPurchase } from "@/services/cards";
import { listHouseholdCategories } from "@/services/categories";
import { createDebt, listDebtInstallments } from "@/services/debts";
import { createHouseholdForUser } from "@/services/households";
import { getMonthlySummary } from "@/services/monthly-summary";
import {
  copyPreviousMonthPlanning,
  getMonthlyPlanningBoard,
  PlanningError,
  settlePlanningLedgerItem,
} from "@/services/planning";
import {
  createRecurringRule,
  deleteRecurringOccurrence,
  materializeRecurrencesForMonth,
  updateRecurringOccurrence,
} from "@/services/recurrences";
import { createTransaction, LedgerError, setTransactionStatus } from "@/services/transactions";

const canWrite = Boolean(process.env.TEST_DATABASE_URL);
if (canWrite) {
  requireTestDatabaseUrl();
}

const db = canWrite ? getDb() : null!;
const createdUserIds: string[] = [];
const createdHouseholdIds: string[] = [];

async function insertUser(name: string) {
  const id = crypto.randomUUID();
  const email = `vitest-p42-${id}@example.test`;
  await db.insert(user).values({ id, name, email, emailVerified: true });
  createdUserIds.push(id);
  return { id, email, name };
}

describe.skipIf(!canWrite).sequential("monthly planning", { timeout: 40_000 }, () => {
  afterAll(async () => {
    if (createdHouseholdIds.length > 0) {
      await db.delete(households).where(inArray(households.id, createdHouseholdIds));
    }

    if (createdUserIds.length > 0) {
      await db.delete(user).where(inArray(user.id, createdUserIds));
    }

    await closeDb();
  });

  it("builds spreadsheet totals, pays safely, copies once and isolates households", async () => {
    const ownerA = await insertUser("Owner Plan A");
    const ownerB = await insertUser("Owner Plan B");
    const houseA = await createHouseholdForUser({ userId: ownerA.id, name: "Casa Plan A" });
    const houseB = await createHouseholdForUser({ userId: ownerB.id, name: "Casa Plan B" });
    createdHouseholdIds.push(houseA.household.id, houseB.household.id);

    const accountA = await createFinancialAccount({
      userId: ownerA.id,
      householdId: houseA.household.id,
      name: "Caixa A",
      type: "CASH",
      openingBalanceCents: BigInt(10_000_000),
      openingBalanceDate: "2026-08-01",
    });
    const accountB = await createFinancialAccount({
      userId: ownerB.id,
      householdId: houseB.household.id,
      name: "Caixa B",
      type: "CASH",
      openingBalanceCents: BigInt(1_000_000),
      openingBalanceDate: "2026-08-01",
    });
    const catsA = await listHouseholdCategories(houseA.household.id);
    const salary = catsA.find((item) => item.slug === "salario")!;
    const mercado = catsA.find((item) => item.slug === "mercado")!;
    const dividas = catsA.find((item) => item.slug === "dividas")!;

    await createTransaction({
      userId: ownerA.id,
      householdId: houseA.household.id,
      type: "INCOME",
      description: "Salário",
      amountCents: BigInt(2_400_000),
      accountId: accountA!.id,
      categoryId: salary.id,
      transactionDate: "2026-09-01",
      status: "PLANNED",
    });
    await createTransaction({
      userId: ownerA.id,
      householdId: houseA.household.id,
      type: "INCOME",
      description: "Receita da esposa",
      amountCents: BigInt(2_100_000),
      accountId: accountA!.id,
      categoryId: salary.id,
      transactionDate: "2026-09-05",
      status: "PENDING",
    });
    await createTransaction({
      userId: ownerA.id,
      householdId: houseA.household.id,
      type: "INCOME",
      description: "Extra",
      amountCents: BigInt(100_000),
      accountId: accountA!.id,
      categoryId: salary.id,
      transactionDate: "2026-09-10",
      status: "PLANNED",
    });

    const bigBill = await createTransaction({
      userId: ownerA.id,
      householdId: houseA.household.id,
      type: "EXPENSE",
      description: "Contas do mês",
      amountCents: BigInt(5_643_193),
      accountId: accountA!.id,
      categoryId: mercado.id,
      transactionDate: "2026-09-12",
      dueDate: "2026-09-12",
      status: "PENDING",
    });
    const reminder = await createTransaction({
      userId: ownerA.id,
      householdId: houseA.household.id,
      type: "EXPENSE",
      description: "Luz a definir",
      amountCents: BigInt(0),
      accountId: accountA!.id,
      categoryId: mercado.id,
      transactionDate: "2026-09-20",
      status: "PLANNED",
    });
    const noDue = await createTransaction({
      userId: ownerA.id,
      householdId: houseA.household.id,
      type: "EXPENSE",
      description: "Sem vencimento",
      amountCents: BigInt(1_000),
      accountId: accountA!.id,
      categoryId: mercado.id,
      transactionDate: "2026-09-08",
      status: "PLANNED",
    });

    await createTransaction({
      userId: ownerA.id,
      householdId: houseA.household.id,
      type: "TRANSFER",
      description: "Reforço",
      amountCents: BigInt(50_000),
      accountId: accountA!.id,
      destinationAccountId: accountA!.id,
      transactionDate: "2026-09-03",
      status: "PAID",
    }).catch(() => undefined);

    const secondAccount = await createFinancialAccount({
      userId: ownerA.id,
      householdId: houseA.household.id,
      name: "Banco A",
      type: "CHECKING",
      openingBalanceCents: BigInt(0),
      openingBalanceDate: "2026-08-01",
    });
    await createTransaction({
      userId: ownerA.id,
      householdId: houseA.household.id,
      type: "TRANSFER",
      description: "Reforço interno",
      amountCents: BigInt(50_000),
      accountId: accountA!.id,
      destinationAccountId: secondAccount!.id,
      transactionDate: "2026-09-03",
      status: "PAID",
    });

    const card = await createCreditCard({
      userId: ownerA.id,
      householdId: houseA.household.id,
      name: "Nubank",
      issuer: "Nubank",
      holderUserId: ownerA.id,
      limitCents: BigInt(500_000),
      closingDay: 10,
      dueDay: 17,
    });
    await createCardPurchase({
      userId: ownerA.id,
      householdId: houseA.household.id,
      creditCardId: card!.id,
      categoryId: mercado.id,
      description: "Compra cartão",
      totalAmountCents: BigInt(20_000),
      purchaseDate: "2026-09-05",
      installmentCount: 1,
    });

    await createDebt({
      userId: ownerA.id,
      householdId: houseA.household.id,
      name: "Empréstimo",
      creditor: "Banco",
      categoryId: dividas.id,
      originalAmountCents: BigInt(30_000),
      outstandingBalanceCents: BigInt(30_000),
      installmentAmountCents: BigInt(30_000),
      totalInstallments: 1,
      firstDueDate: "2026-09-18",
    });

    const augustCopy = await createTransaction({
      userId: ownerA.id,
      householdId: houseA.household.id,
      type: "EXPENSE",
      description: "Internet agosto",
      amountCents: BigInt(12_000),
      accountId: accountA!.id,
      categoryId: mercado.id,
      transactionDate: "2026-08-10",
      dueDate: "2026-08-10",
      status: "PLANNED",
    });

    const empty = await getMonthlyPlanningBoard({
      userId: ownerA.id,
      householdId: houseA.household.id,
      year: 2027,
      month: 1,
    });
    expect(empty.empty).toBe(true);
    expect(empty.totals.plannedBalanceLabel).toBe("R$ 0,00");

    const board = await getMonthlyPlanningBoard({
      userId: ownerA.id,
      householdId: houseA.household.id,
      year: 2026,
      month: 9,
    });

    expect(board.totals.plannedIncomeLabel).toBe("R$ 46.000,00");
    expect(board.totals.plannedBalanceLabel).toBe("-R$ 10.941,93");
    expect(board.incomes).toHaveLength(3);
    expect(board.bills.some((item) => item.description === "Reforço interno")).toBe(false);
    expect(board.bills.filter((item) => item.origin === "CARD")).toHaveLength(1);
    expect(board.bills.filter((item) => item.origin === "DEBT")).toHaveLength(1);
    expect(board.bills.find((item) => item.sourceId === reminder!.id)?.statusLabel).toBe("A definir");
    expect(board.bills.find((item) => item.sourceId === noDue!.id)?.dueDateLabel).toBe("Sem vencimento");
    expect(board.bills.some((item) => item.origin === "LEDGER" && item.description === "Contas do mês")).toBe(true);

    await expect(
      setTransactionStatus({
        userId: ownerA.id,
        householdId: houseA.household.id,
        transactionId: reminder!.id,
        status: "PAID",
      }),
    ).rejects.toMatchObject({ code: "UNDEFINED_AMOUNT" });

    await expect(
      settlePlanningLedgerItem({
        userId: ownerA.id,
        householdId: houseA.household.id,
        transactionId: reminder!.id,
        amountCents: BigInt(0),
        accountId: accountA!.id,
        paidAt: "2026-09-20",
      }),
    ).rejects.toBeInstanceOf(LedgerError);

    const summaryBefore = await getMonthlySummary(houseA.household.id, 2026, 9);
    const plannedBefore = board.totals.plannedBalanceLabel;
    const billsBefore = board.totals.billsTotalLabel;

    await settlePlanningLedgerItem({
      userId: ownerA.id,
      householdId: houseA.household.id,
      transactionId: bigBill!.id,
      amountCents: BigInt(5_643_193),
      accountId: accountA!.id,
      paidAt: "2026-09-15",
    });

    await expect(
      settlePlanningLedgerItem({
        userId: ownerA.id,
        householdId: houseA.household.id,
        transactionId: bigBill!.id,
        amountCents: BigInt(5_643_193),
        accountId: accountA!.id,
        paidAt: "2026-09-16",
      }),
    ).rejects.toMatchObject({ code: "ALREADY_PAID" });

    const afterPay = await getMonthlyPlanningBoard({
      userId: ownerA.id,
      householdId: houseA.household.id,
      year: 2026,
      month: 9,
    });
    const summaryAfter = await getMonthlySummary(houseA.household.id, 2026, 9);
    expect(afterPay.totals.plannedBalanceLabel).toBe(plannedBefore);
    expect(afterPay.totals.billsTotalLabel).toBe(billsBefore);
    expect(afterPay.totals.paidBillsLabel).toBe("R$ 56.431,93");
    expect(afterPay.totals.remainingToPayLabel).not.toBe(board.totals.remainingToPayLabel);
    expect(summaryAfter.currentHouseholdCents).toBe(
      summaryBefore.currentHouseholdCents - BigInt(5_643_193),
    );

    const copied = await copyPreviousMonthPlanning({
      userId: ownerA.id,
      householdId: houseA.household.id,
      year: 2026,
      month: 9,
      transactionIds: [augustCopy!.id],
    });
    expect(copied.created).toBe(1);
    await expect(
      copyPreviousMonthPlanning({
        userId: ownerA.id,
        householdId: houseA.household.id,
        year: 2026,
        month: 9,
        transactionIds: [augustCopy!.id],
      }),
    ).rejects.toBeInstanceOf(PlanningError);

    const afterCopy = await getMonthlyPlanningBoard({
      userId: ownerA.id,
      householdId: houseA.household.id,
      year: 2026,
      month: 9,
    });
    expect(afterCopy.bills.filter((item) => item.description === "Internet agosto")).toHaveLength(1);
    expect(afterCopy.bills.find((item) => item.description === "Internet agosto")?.dueDate).toBe("2026-09-10");

    await expect(
      getMonthlyPlanningBoard({
        userId: ownerB.id,
        householdId: houseA.household.id,
        year: 2026,
        month: 9,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      settlePlanningLedgerItem({
        userId: ownerB.id,
        householdId: houseB.household.id,
        transactionId: bigBill!.id,
        amountCents: BigInt(1_000),
        accountId: accountB!.id,
        paidAt: "2026-09-15",
      }),
    ).rejects.toBeInstanceOf(LedgerError);

    const installments = await listDebtInstallments(houseA.household.id);
    expect(installments.filter((item) => item.dueDate.startsWith("2026-09"))).toHaveLength(1);
  });

  it("materializes a recurrence in the requested month and clamps day 31", async () => {
    const owner = await insertUser("Owner Recurrence");
    const house = await createHouseholdForUser({ userId: owner.id, name: "Casa Recurrence" });
    createdHouseholdIds.push(house.household.id);
    const account = await createFinancialAccount({
      userId: owner.id,
      householdId: house.household.id,
      name: "Caixa",
      type: "CASH",
      openingBalanceCents: BigInt(1_000),
      openingBalanceDate: "2026-07-01",
    });
    const cats = await listHouseholdCategories(house.household.id);
    const internet = cats.find((item) => item.slug === "internet") ?? cats.find((item) => item.type === "EXPENSE")!;

    await createRecurringRule({
      userId: owner.id,
      householdId: house.household.id,
      accountId: account!.id,
      categoryId: internet.id,
      description: "Internet 31",
      type: "EXPENSE",
      amountCents: BigInt(12_000),
      dueDay: 31,
      startDate: "2026-07-01",
      defaultStatus: "PENDING",
    });

    await materializeRecurrencesForMonth({
      userId: owner.id,
      householdId: house.household.id,
      year: 2026,
      month: 7,
    });
    await materializeRecurrencesForMonth({
      userId: owner.id,
      householdId: house.household.id,
      year: 2026,
      month: 9,
    });
    await materializeRecurrencesForMonth({
      userId: owner.id,
      householdId: house.household.id,
      year: 2026,
      month: 9,
    });

    const september = await getMonthlyPlanningBoard({
      userId: owner.id,
      householdId: house.household.id,
      year: 2026,
      month: 9,
    });
    const july = await getMonthlyPlanningBoard({
      userId: owner.id,
      householdId: house.household.id,
      year: 2026,
      month: 7,
    });

    expect(september.bills.filter((item) => item.description === "Internet 31")).toHaveLength(1);
    expect(september.bills.find((item) => item.description === "Internet 31")?.dueDate).toBe("2026-09-30");
    expect(july.bills.find((item) => item.description === "Internet 31")?.dueDate).toBe("2026-07-31");
    expect(september.bills.some((item) => item.dueDate === "2026-07-31")).toBe(false);
  });

  it("updates only this occurrence or this and future recurring months", async () => {
    const owner = await insertUser("Owner Recurring Edit");
    const house = await createHouseholdForUser({ userId: owner.id, name: "Casa Recurring Edit" });
    createdHouseholdIds.push(house.household.id);
    const account = await createFinancialAccount({
      userId: owner.id,
      householdId: house.household.id,
      name: "Caixa",
      type: "CASH",
      openingBalanceCents: BigInt(1_000),
      openingBalanceDate: "2026-08-01",
    });
    const cats = await listHouseholdCategories(house.household.id);
    const moradia = cats.find((item) => item.slug === "moradia") ?? cats.find((item) => item.type === "EXPENSE")!;

    await createRecurringRule({
      userId: owner.id,
      householdId: house.household.id,
      accountId: account!.id,
      categoryId: moradia.id,
      description: "Guarda",
      type: "EXPENSE",
      amountCents: BigInt(4_000),
      dueDay: 10,
      startDate: "2026-09-01",
      defaultStatus: "PLANNED",
    });

    await materializeRecurrencesForMonth({
      userId: owner.id,
      householdId: house.household.id,
      year: 2026,
      month: 9,
    });
    await materializeRecurrencesForMonth({
      userId: owner.id,
      householdId: house.household.id,
      year: 2026,
      month: 10,
    });

    const september = await getMonthlyPlanningBoard({
      userId: owner.id,
      householdId: house.household.id,
      year: 2026,
      month: 9,
    });
    const current = september.bills.find((item) => item.description === "Guarda")!;

    await updateRecurringOccurrence({
      userId: owner.id,
      householdId: house.household.id,
      transactionId: current.sourceId,
      description: "Guarda",
      amountCents: BigInt(6_000),
      accountId: account!.id,
      categoryId: moradia.id,
      transactionDate: "2026-09-10",
      dueDate: "2026-09-10",
      type: "EXPENSE",
      status: "PLANNED",
      scope: "THIS",
    });

    const afterThis = await getMonthlyPlanningBoard({
      userId: owner.id,
      householdId: house.household.id,
      year: 2026,
      month: 10,
    });
    expect(afterThis.bills.find((item) => item.description === "Guarda")?.amountLabel).toBe("R$ 40,00");
    expect(
      (await getMonthlyPlanningBoard({
        userId: owner.id,
        householdId: house.household.id,
        year: 2026,
        month: 9,
      })).bills.find((item) => item.description === "Guarda")?.amountLabel,
    ).toBe("R$ 60,00");

    await updateRecurringOccurrence({
      userId: owner.id,
      householdId: house.household.id,
      transactionId: current.sourceId,
      description: "Guarda mensal",
      amountCents: BigInt(5_500),
      accountId: account!.id,
      categoryId: moradia.id,
      transactionDate: "2026-09-10",
      dueDate: "2026-09-10",
      type: "EXPENSE",
      status: "PLANNED",
      scope: "THIS_AND_FUTURE",
    });

    const afterFutureSept = await getMonthlyPlanningBoard({
      userId: owner.id,
      householdId: house.household.id,
      year: 2026,
      month: 9,
    });
    const afterFutureOct = await getMonthlyPlanningBoard({
      userId: owner.id,
      householdId: house.household.id,
      year: 2026,
      month: 10,
    });
    expect(afterFutureSept.bills.find((item) => item.description === "Guarda mensal")?.amountLabel).toBe("R$ 55,00");
    expect(afterFutureOct.bills.find((item) => item.description === "Guarda mensal")?.amountLabel).toBe("R$ 55,00");
  });

  it("deletes only this occurrence or this and future recurring months", async () => {
    const owner = await insertUser("Owner Recurring Delete");
    const house = await createHouseholdForUser({ userId: owner.id, name: "Casa Recurring Delete" });
    createdHouseholdIds.push(house.household.id);
    const account = await createFinancialAccount({
      userId: owner.id,
      householdId: house.household.id,
      name: "Caixa",
      type: "CASH",
      openingBalanceCents: BigInt(1_000),
      openingBalanceDate: "2026-08-01",
    });
    const cats = await listHouseholdCategories(house.household.id);
    const moradia = cats.find((item) => item.slug === "moradia") ?? cats.find((item) => item.type === "EXPENSE")!;

    await createRecurringRule({
      userId: owner.id,
      householdId: house.household.id,
      accountId: account!.id,
      categoryId: moradia.id,
      description: "Luz",
      type: "EXPENSE",
      amountCents: BigInt(8_000),
      dueDay: 5,
      startDate: "2026-09-01",
      defaultStatus: "PLANNED",
    });
    await materializeRecurrencesForMonth({
      userId: owner.id,
      householdId: house.household.id,
      year: 2026,
      month: 9,
    });
    await materializeRecurrencesForMonth({
      userId: owner.id,
      householdId: house.household.id,
      year: 2026,
      month: 10,
    });

    const september = await getMonthlyPlanningBoard({
      userId: owner.id,
      householdId: house.household.id,
      year: 2026,
      month: 9,
    });
    const current = september.bills.find((item) => item.description === "Luz")!;

    await deleteRecurringOccurrence({
      userId: owner.id,
      householdId: house.household.id,
      transactionId: current.sourceId,
      scope: "THIS",
    });

    expect(
      (await getMonthlyPlanningBoard({
        userId: owner.id,
        householdId: house.household.id,
        year: 2026,
        month: 9,
      })).bills.find((item) => item.description === "Luz"),
    ).toBeUndefined();
    expect(
      (await getMonthlyPlanningBoard({
        userId: owner.id,
        householdId: house.household.id,
        year: 2026,
        month: 10,
      })).bills.find((item) => item.description === "Luz")?.amountLabel,
    ).toBe("R$ 80,00");

    const october = await getMonthlyPlanningBoard({
      userId: owner.id,
      householdId: house.household.id,
      year: 2026,
      month: 10,
    });
    await deleteRecurringOccurrence({
      userId: owner.id,
      householdId: house.household.id,
      transactionId: october.bills.find((item) => item.description === "Luz")!.sourceId,
      scope: "THIS_AND_FUTURE",
    });

    await materializeRecurrencesForMonth({
      userId: owner.id,
      householdId: house.household.id,
      year: 2026,
      month: 11,
    });

    expect(
      (await getMonthlyPlanningBoard({
        userId: owner.id,
        householdId: house.household.id,
        year: 2026,
        month: 10,
      })).bills.find((item) => item.description === "Luz"),
    ).toBeUndefined();
    expect(
      (await getMonthlyPlanningBoard({
        userId: owner.id,
        householdId: house.household.id,
        year: 2026,
        month: 11,
      })).bills.find((item) => item.description === "Luz"),
    ).toBeUndefined();
  });
});
