import { describe, expect, it } from "vitest";

import {
  availableBalance,
  budgetAlertLevel,
  budgetPercent,
  currentAccountBalance,
  currentHouseholdBalance,
  householdNetWorthFromAccounts,
  investmentReserve,
  investmentTotals,
  paidInMonth,
  pendingExpensesThrough,
  pendingIncomeThrough,
  type LedgerAccount,
  type LedgerCategory,
  type LedgerTransaction,
} from "@/domain/ledger";
import { lastDayOfMonth, occurrenceDate } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { shouldGenerateOccurrence } from "@/services/recurrences";

const house = "house-a";
const accountA: LedgerAccount = { id: "acc-a", openingBalanceCents: BigInt(100_000), active: true };
const accountB: LedgerAccount = { id: "acc-b", openingBalanceCents: BigInt(50_000), active: true };

function tx(partial: Partial<LedgerTransaction> & Pick<LedgerTransaction, "id" | "type" | "amountCents" | "status">): LedgerTransaction {
  return {
    householdId: house,
    accountId: "acc-a",
    destinationAccountId: null,
    categoryId: "cat-expense",
    transactionDate: "2026-08-10",
    dueDate: "2026-08-15",
    paidAt: partial.status === "PAID" ? new Date("2026-08-12T15:00:00.000Z") : null,
    ...partial,
  };
}

const categories: LedgerCategory[] = [
  { id: "cat-expense", householdId: house, type: "EXPENSE", kind: "VARIABLE" },
  { id: "cat-invest", householdId: house, type: "EXPENSE", kind: "INVESTMENT" },
];

describe("ledger balances", () => {
  it("adds paid income and subtracts paid expenses in cents", () => {
    const transactions = [
      tx({ id: "1", type: "INCOME", amountCents: BigInt(20_000), status: "PAID", categoryId: "cat-income" }),
      tx({ id: "2", type: "EXPENSE", amountCents: BigInt(5_000), status: "PAID" }),
    ];

    expect(currentAccountBalance(accountA, transactions)).toBe(BigInt(115_000));
    expect(formatBRL(currentAccountBalance(accountA, transactions))).toBe("R$ 1.150,00");
  });

  it("ignores pending, cancelled and soft-deleted movements", () => {
    const transactions = [
      tx({ id: "1", type: "INCOME", amountCents: BigInt(20_000), status: "PENDING" }),
      tx({ id: "2", type: "EXPENSE", amountCents: BigInt(5_000), status: "CANCELLED", paidAt: new Date() }),
      tx({ id: "3", type: "EXPENSE", amountCents: BigInt(7_000), status: "PAID", deletedAt: new Date() }),
    ];

    expect(currentAccountBalance(accountA, transactions)).toBe(accountA.openingBalanceCents);
  });

  it("moves money between accounts without changing household net worth", () => {
    const transactions = [
      tx({
        id: "t1",
        type: "TRANSFER",
        amountCents: BigInt(10_000),
        status: "PAID",
        categoryId: null,
        destinationAccountId: "acc-b",
      }),
    ];

    expect(currentAccountBalance(accountA, transactions)).toBe(BigInt(90_000));
    expect(currentAccountBalance(accountB, transactions)).toBe(BigInt(60_000));
    expect(currentHouseholdBalance([accountA, accountB], transactions)).toBe(BigInt(150_000));
    expect(
      householdNetWorthFromAccounts([
        { id: "acc-a", balanceCents: BigInt(90_000), active: true },
        { id: "acc-b", balanceCents: BigInt(60_000), active: true },
      ]),
    ).toBe(BigInt(150_000));
  });

  it("uses pending income and expenses through month end", () => {
    const transactions = [
      tx({ id: "1", type: "INCOME", amountCents: BigInt(3_000), status: "PLANNED", dueDate: "2026-08-20", categoryId: "cat-income" }),
      tx({ id: "2", type: "EXPENSE", amountCents: BigInt(1_200), status: "PENDING", dueDate: "2026-08-31" }),
      tx({ id: "3", type: "EXPENSE", amountCents: BigInt(9_999), status: "PENDING", dueDate: "2026-09-01" }),
    ];

    expect(pendingIncomeThrough(transactions, "2026-08-31")).toBe(BigInt(3_000));
    expect(pendingExpensesThrough(transactions, "2026-08-31")).toBe(BigInt(1_200));
  });

  it("does not double-count a launched investment in the reserve", () => {
    const transactions = [
      tx({ id: "1", type: "EXPENSE", amountCents: BigInt(10_000), status: "PAID", categoryId: "cat-invest" }),
      tx({ id: "2", type: "EXPENSE", amountCents: BigInt(4_000), status: "PENDING", categoryId: "cat-invest" }),
    ];
    const totals = investmentTotals(transactions, categories, {
      yearMonth: "2026-08",
      throughDate: "2026-08-31",
      paidAtDate: (item) => (item.paidAt ? "2026-08-12" : null),
    });

    expect(totals.realized).toBe(BigInt(10_000));
    expect(totals.pendingPosted).toBe(BigInt(4_000));
    expect(
      investmentReserve({
        plannedCents: BigInt(20_000),
        realizedCents: totals.realized,
        pendingPostedCents: totals.pendingPosted,
      }),
    ).toBe(BigInt(6_000));
  });

  it("computes the official available balance", () => {
    const available = availableBalance({
      currentHouseholdCents: BigInt(150_000),
      pendingIncomeCents: BigInt(3_000),
      pendingExpenseCents: BigInt(1_200),
      investmentReserveCents: BigInt(6_000),
    });

    expect(available).toBe(BigInt(145_800));
    expect(formatBRL(available)).not.toBe("R$ —");
  });

  it("computes budget percent and alert bands", () => {
    expect(budgetPercent(BigInt(79), BigInt(100))).toBe(79);
    expect(budgetAlertLevel(79)).toBe("ok");
    expect(budgetAlertLevel(80)).toBe("warning");
    expect(budgetAlertLevel(100)).toBe("over");
  });

  it("recalculates the account balance after a status change", () => {
    const paid = tx({ id: "1", type: "INCOME", amountCents: BigInt(20_000), status: "PAID", categoryId: "cat-income" });
    expect(currentAccountBalance(accountA, [paid])).toBe(BigInt(120_000));

    const pending = { ...paid, status: "PENDING" as const, paidAt: null };
    expect(currentAccountBalance(accountA, [pending])).toBe(accountA.openingBalanceCents);
  });

  it("keeps exact cent values without floating point", () => {
    const transactions = [
      tx({ id: "1", type: "INCOME", amountCents: BigInt(101), status: "PAID", categoryId: "cat-income" }),
      tx({ id: "2", type: "EXPENSE", amountCents: BigInt(33), status: "PAID" }),
    ];

    expect(currentAccountBalance(accountA, transactions)).toBe(BigInt(100_068));
    expect(formatBRL(currentAccountBalance(accountA, transactions))).toBe("R$ 1.000,68");
  });

  it("sums paid cashflow by Sao Paulo month", () => {
    const transactions = [
      tx({ id: "1", type: "INCOME", amountCents: BigInt(8_000), status: "PAID", categoryId: "cat-income" }),
    ];

    expect(
      paidInMonth(transactions, {
        type: "INCOME",
        yearMonth: "2026-08",
        paidAtDate: () => "2026-08-12",
      }),
    ).toBe(BigInt(8_000));
  });
});

describe("recurrence dates", () => {
  it("uses the last valid day when due day is 31 in February", () => {
    expect(lastDayOfMonth(2026, 2)).toBe(28);
    expect(occurrenceDate(2026, 2, 31)).toBe("2026-02-28");
  });

  it("generates the start month even when the due day is before the start day", () => {
    expect(
      shouldGenerateOccurrence({
        startDate: "2026-08-22",
        endDate: null,
        occurrenceDate: "2026-08-10",
        active: true,
      }),
    ).toBe(true);
  });

  it("does not generate after the rule end date", () => {
    expect(
      shouldGenerateOccurrence({
        startDate: "2026-01-01",
        endDate: "2026-01-31",
        occurrenceDate: "2026-02-28",
        active: true,
      }),
    ).toBe(false);
  });

  it("does not generate inactive rules", () => {
    expect(
      shouldGenerateOccurrence({
        startDate: "2026-01-01",
        endDate: null,
        occurrenceDate: "2026-02-01",
        active: false,
      }),
    ).toBe(false);
  });
});
