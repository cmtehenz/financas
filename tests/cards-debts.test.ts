import { describe, expect, it } from "vitest";

import {
  cardAvailableLimitCents,
  cardBudgetForMonth,
  cardUsedLimitCents,
  deriveStatementStatus,
  dueDateForStatement,
  firstStatementMonth,
  previewCardInstallments,
  splitInstallments,
  statementPendingCents,
  statementPeriodForInstallment,
  unpaidStatementsThrough,
} from "@/domain/cards";
import { buildDebtSchedule, debtOutstandingFromSchedule } from "@/domain/debts";
import { availableBalance, currentAccountBalance, currentHouseholdBalance } from "@/domain/ledger";
import { formatBRL } from "@/lib/money";

describe("card installment math", () => {
  it("splits remainders into the first installments", () => {
    expect(splitInstallments(BigInt(10_000), 3)).toEqual([BigInt(3_334), BigInt(3_333), BigInt(3_333)]);
    expect(splitInstallments(BigInt(10_000), 3).reduce((total, item) => total + item, BigInt(0))).toBe(BigInt(10_000));
  });

  it("does not use floating point for 1200 in 12", () => {
    const parts = splitInstallments(BigInt(120_000), 12);
    expect(parts).toHaveLength(12);
    expect(parts.every((item) => item === BigInt(10_000))).toBe(true);
    expect(formatBRL(parts[0]!)).toBe("R$ 100,00");
  });
});

describe("statement closing calendar", () => {
  it("puts a purchase on the closing day in that statement", () => {
    expect(firstStatementMonth("2026-08-10", 10)).toEqual({ year: 2026, month: 8 });
    expect(statementPeriodForInstallment("2026-08-10", 10, 17, 0)).toMatchObject({
      closingDate: "2026-08-10",
      dueDate: "2026-08-17",
    });
  });

  it("puts a purchase after closing in the next statement", () => {
    expect(firstStatementMonth("2026-08-11", 10)).toEqual({ year: 2026, month: 9 });
    const first = statementPeriodForInstallment("2026-08-11", 10, 17, 0);
    const second = statementPeriodForInstallment("2026-08-11", 10, 17, 1);
    expect(first.monthKey).toBe("2026-09");
    expect(second.monthKey).toBe("2026-10");
  });

  it("uses the last day when closing is 31 in February", () => {
    const period = statementPeriodForInstallment("2026-02-10", 31, 10, 0);
    expect(period.closingDate).toBe("2026-02-28");
    expect(period.dueDate).toBe("2026-03-10");
  });

  it("moves due date to the next month when due day is before closing", () => {
    expect(dueDateForStatement(2026, 8, 25, 10)).toBe("2026-09-10");
  });

  it("keeps consecutive installment months", () => {
    const preview = previewCardInstallments({
      totalAmountCents: BigInt(9_000),
      installmentCount: 3,
      purchaseDate: "2026-08-11",
      closingDay: 10,
      dueDay: 17,
    });
    expect(preview.map((item) => item.monthKey)).toEqual(["2026-09", "2026-10", "2026-11"]);
  });
});

describe("card limits and budget", () => {
  it("computes used and negative available limits", () => {
    expect(cardAvailableLimitCents(BigInt(1_000), BigInt(1_200))).toBe(BigInt(-200));
  });

  it("frees used limit proportionally after a partial payment", () => {
    expect(cardUsedLimitCents(BigInt(400_000), BigInt(100_000))).toBe(BigInt(300_000));
    expect(cardAvailableLimitCents(BigInt(1_000_000), BigInt(300_000))).toBe(BigInt(700_000));
  });

  it("frees the full used limit after a total payment", () => {
    expect(cardUsedLimitCents(BigInt(400_000), BigInt(400_000))).toBe(BigInt(0));
  });

  it("keeps future installments in used limit after paying only the current statement", () => {
    expect(cardUsedLimitCents(BigInt(1_200_000), BigInt(100_000))).toBe(BigInt(1_100_000));
  });

  it("does not put the full purchase in the first month", () => {
    const preview = previewCardInstallments({
      totalAmountCents: BigInt(120_000),
      installmentCount: 12,
      purchaseDate: "2026-08-11",
      closingDay: 10,
      dueDay: 17,
    });
    expect(cardBudgetForMonth(preview.map((item) => ({ ...item, purchaseActive: true })), 2026, 9)).toBe(BigInt(10_000));
    expect(cardBudgetForMonth(preview.map((item) => ({ ...item, purchaseActive: true })), 2026, 8)).toBe(BigInt(0));
  });

  it("ignores cancelled purchases in budget and limit", () => {
    const preview = previewCardInstallments({
      totalAmountCents: BigInt(10_000),
      installmentCount: 1,
      purchaseDate: "2026-08-05",
      closingDay: 10,
      dueDay: 17,
    });
    expect(cardBudgetForMonth(preview.map((item) => ({ ...item, purchaseActive: false })), 2026, 8)).toBe(BigInt(0));
  });

  it("excludes cancelled purchases from used limit", () => {
    expect(cardUsedLimitCents(BigInt(4_000), BigInt(0))).toBe(BigInt(4_000));
    expect(cardUsedLimitCents(BigInt(0), BigInt(0))).toBe(BigInt(0));
  });

  it("derives statement status from dates and payments", () => {
    expect(
      deriveStatementStatus({
        today: "2026-08-01",
        closingDate: "2026-08-10",
        totalCents: BigInt(2_000),
        paidCents: BigInt(0),
      }),
    ).toBe("OPEN");
    expect(
      deriveStatementStatus({
        today: "2026-08-11",
        closingDate: "2026-08-10",
        totalCents: BigInt(2_000),
        paidCents: BigInt(0),
      }),
    ).toBe("CLOSED");
    expect(
      deriveStatementStatus({
        today: "2026-08-11",
        closingDate: "2026-08-10",
        totalCents: BigInt(2_000),
        paidCents: BigInt(500),
      }),
    ).toBe("PARTIALLY_PAID");
    expect(
      deriveStatementStatus({
        today: "2026-08-11",
        closingDate: "2026-08-10",
        totalCents: BigInt(2_000),
        paidCents: BigInt(2_000),
      }),
    ).toBe("PAID");
  });
});

describe("available balance with cards and debts", () => {
  it("keeps available unchanged after paying a statement due this month", () => {
    const before = availableBalance({
      currentHouseholdCents: BigInt(1_000_000),
      pendingIncomeCents: BigInt(0),
      pendingExpenseCents: BigInt(0),
      investmentReserveCents: BigInt(0),
      unpaidCardStatementsCents: BigInt(200_000),
    });
    const after = availableBalance({
      currentHouseholdCents: BigInt(800_000),
      pendingIncomeCents: BigInt(0),
      pendingExpenseCents: BigInt(0),
      investmentReserveCents: BigInt(0),
      unpaidCardStatementsCents: BigInt(0),
    });
    expect(before).toBe(BigInt(800_000));
    expect(after).toBe(before);
  });

  it("keeps available unchanged after paying a debt installment", () => {
    const before = availableBalance({
      currentHouseholdCents: BigInt(1_000_000),
      pendingIncomeCents: BigInt(0),
      pendingExpenseCents: BigInt(50_000),
      investmentReserveCents: BigInt(0),
      unpaidCardStatementsCents: BigInt(0),
    });
    const after = availableBalance({
      currentHouseholdCents: BigInt(950_000),
      pendingIncomeCents: BigInt(0),
      pendingExpenseCents: BigInt(0),
      investmentReserveCents: BigInt(0),
      unpaidCardStatementsCents: BigInt(0),
    });
    expect(before).toBe(after);
  });

  it("drops cash now when a next-month statement is paid early", () => {
    const current = availableBalance({
      currentHouseholdCents: BigInt(1_000_000),
      pendingIncomeCents: BigInt(0),
      pendingExpenseCents: BigInt(0),
      investmentReserveCents: BigInt(0),
      unpaidCardStatementsCents: BigInt(0),
    });
    const afterEarlyPay = availableBalance({
      currentHouseholdCents: BigInt(800_000),
      pendingIncomeCents: BigInt(0),
      pendingExpenseCents: BigInt(0),
      investmentReserveCents: BigInt(0),
      unpaidCardStatementsCents: BigInt(0),
    });
    expect(current).toBe(BigInt(1_000_000));
    expect(afterEarlyPay).toBe(BigInt(800_000));

    const nextMonthBefore = availableBalance({
      currentHouseholdCents: BigInt(1_000_000),
      pendingIncomeCents: BigInt(0),
      pendingExpenseCents: BigInt(0),
      investmentReserveCents: BigInt(0),
      unpaidCardStatementsCents: BigInt(200_000),
    });
    const nextMonthAfter = availableBalance({
      currentHouseholdCents: BigInt(800_000),
      pendingIncomeCents: BigInt(0),
      pendingExpenseCents: BigInt(0),
      investmentReserveCents: BigInt(0),
      unpaidCardStatementsCents: BigInt(0),
    });
    expect(nextMonthBefore).toBe(nextMonthAfter);
  });

  it("handles partial, total and last-day payments without double counting", () => {
    const partial = availableBalance({
      currentHouseholdCents: BigInt(900_000),
      pendingIncomeCents: BigInt(0),
      pendingExpenseCents: BigInt(0),
      investmentReserveCents: BigInt(0),
      unpaidCardStatementsCents: BigInt(100_000),
    });
    const total = availableBalance({
      currentHouseholdCents: BigInt(800_000),
      pendingIncomeCents: BigInt(0),
      pendingExpenseCents: BigInt(0),
      investmentReserveCents: BigInt(0),
      unpaidCardStatementsCents: BigInt(0),
    });
    expect(partial).toBe(BigInt(800_000));
    expect(total).toBe(partial);
    expect(unpaidStatementsThrough([{ dueDate: "2026-08-31", pendingCents: BigInt(50_000) }], "2026-08-31")).toBe(
      BigInt(50_000),
    );
    expect(unpaidStatementsThrough([{ dueDate: "2026-09-01", pendingCents: BigInt(50_000) }], "2026-08-31")).toBe(
      BigInt(0),
    );
  });

  it("does not count a paid statement twice", () => {
    expect(unpaidStatementsThrough([{ dueDate: "2026-08-17", pendingCents: BigInt(0) }], "2026-08-31")).toBe(BigInt(0));
    expect(statementPendingCents(BigInt(2_000), BigInt(2_000))).toBe(BigInt(0));
  });

  it("moves cash on card payment without changing net worth of other accounts", () => {
    const account = { id: "acc", openingBalanceCents: BigInt(1_000_000), active: true };
    const paid = currentAccountBalance(account, [
      {
        id: "p",
        householdId: "h",
        accountId: "acc",
        destinationAccountId: null,
        categoryId: null,
        type: "EXPENSE",
        amountCents: BigInt(200_000),
        status: "PAID",
        origin: "CARD_PAYMENT",
        budgetImpact: false,
        transactionDate: "2026-08-20",
        dueDate: "2026-08-17",
        paidAt: new Date(),
      },
    ]);
    expect(paid).toBe(BigInt(800_000));
    expect(currentHouseholdBalance([account], [])).toBe(BigInt(1_000_000));
  });
});

describe("debt schedule", () => {
  it("builds an exact schedule and uses February 28 for day 31", () => {
    const schedule = buildDebtSchedule({
      firstDueDate: "2026-01-31",
      installmentCount: 3,
      totalCents: BigInt(9_000),
    });
    expect(schedule.map((item) => item.dueDate)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
    expect(schedule.reduce((total, item) => total + item.amountCents, BigInt(0))).toBe(BigInt(9_000));
  });

  it("reduces outstanding after a paid installment", () => {
    const schedule = buildDebtSchedule({
      firstDueDate: "2026-08-10",
      installmentCount: 2,
      totalCents: BigInt(10_000),
    });
    expect(
      debtOutstandingFromSchedule([
        { ...schedule[0]!, status: "PAID" },
        { ...schedule[1]!, status: "PENDING" },
      ]),
    ).toBe(BigInt(5_000));
  });
});
