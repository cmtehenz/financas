import { describe, expect, it } from "vitest";

import {
  belongsToPlanningMonth,
  canMarkPlanningItemPaid,
  derivePlanningStatus,
  formatPlanningAmount,
  investmentRemainderCents,
  isCopyablePlanningTransaction,
  isExcludedPlanningBillTransaction,
  parsePlanningSearchParams,
  planningCopyKey,
  planningMonthTotals,
  planningPath,
  shiftIsoDateToMonth,
} from "@/domain/planning";
import { formatBRL } from "@/lib/money";
import { transactionFormSchema } from "@/lib/validations/ledger";

describe("planning period", () => {
  it("selects the current month when the URL is empty", () => {
    expect(parsePlanningSearchParams({}, "2026-08-23")).toEqual({ year: 2026, month: 8 });
  });

  it("persists year and month from the URL", () => {
    expect(parsePlanningSearchParams({ ano: "2026", mes: "9" }, "2026-08-23")).toEqual({
      year: 2026,
      month: 9,
    });
    expect(planningPath(2026, 9)).toBe("/planejamento?ano=2026&mes=9");
  });

  it("falls back when the year is invalid", () => {
    expect(parsePlanningSearchParams({ ano: "1999", mes: "2" }, "2026-08-23")).toEqual({
      year: 2026,
      month: 8,
    });
  });

  it("belongs to the requested competence month", () => {
    expect(belongsToPlanningMonth("2026-09-15", 2026, 9)).toBe(true);
    expect(belongsToPlanningMonth("2026-07-31", 2026, 9)).toBe(false);
  });
});

describe("spreadsheet totals", () => {
  const incomes = [
    { amountCents: BigInt(2_400_000), visualStatus: "PREVISTA" as const },
    { amountCents: BigInt(2_100_000), visualStatus: "PENDENTE" as const },
    { amountCents: BigInt(100_000), visualStatus: "PREVISTA" as const },
  ];
  const bills = [{ amountCents: BigInt(5_643_193), paidCents: BigInt(0), visualStatus: "PENDENTE" as const }];

  it("matches the family spreadsheet example including a negative planned balance", () => {
    const totals = planningMonthTotals({ incomes, bills });

    expect(formatBRL(totals.plannedIncomeCents)).toBe("R$ 46.000,00");
    expect(formatBRL(totals.billsTotalCents)).toBe("R$ 56.431,93");
    expect(formatBRL(totals.plannedBalanceCents)).toBe("-R$ 10.431,93");
    expect(totals.plannedBalanceCents).toBe(BigInt(-1_043_193));
  });

  it("keeps planned totals when a bill is marked paid", () => {
    const before = planningMonthTotals({ incomes, bills });
    const after = planningMonthTotals({
      incomes,
      bills: [{ ...bills[0], paidCents: bills[0].amountCents, visualStatus: "PAGA" }],
    });

    expect(after.billsTotalCents).toBe(before.billsTotalCents);
    expect(after.plannedBalanceCents).toBe(before.plannedBalanceCents);
    expect(after.paidBillsCents).toBe(bills[0].amountCents);
    expect(after.remainingToPayCents).toBe(BigInt(0));
    expect(before.remainingToPayCents).toBe(bills[0].amountCents);
  });

  it("excludes undefined and cancelled amounts from totals", () => {
    const totals = planningMonthTotals({
      incomes: [
        { amountCents: BigInt(0), visualStatus: "A_DEFINIR" },
        { amountCents: BigInt(100_000), visualStatus: "CANCELADA" },
        { amountCents: BigInt(50_000), visualStatus: "PREVISTA" },
      ],
      bills: [
        { amountCents: BigInt(0), paidCents: BigInt(0), visualStatus: "A_DEFINIR" },
        { amountCents: BigInt(10_000), paidCents: BigInt(0), visualStatus: "CANCELADA" },
        { amountCents: BigInt(20_000), paidCents: BigInt(0), visualStatus: "PENDENTE" },
      ],
    });

    expect(totals.plannedIncomeCents).toBe(BigInt(50_000));
    expect(totals.billsTotalCents).toBe(BigInt(20_000));
    expect(totals.plannedBalanceCents).toBe(BigInt(30_000));
  });
});

describe("planning statuses and amounts", () => {
  it("shows overdue, undefined and no-due-date states without relying on color", () => {
    expect(
      derivePlanningStatus({
        amountCents: BigInt(0),
        status: "PLANNED",
        dueDate: null,
        today: "2026-08-23",
      }),
    ).toBe("A_DEFINIR");
    expect(
      derivePlanningStatus({
        amountCents: BigInt(100),
        status: "PENDING",
        dueDate: "2026-08-01",
        today: "2026-08-23",
      }),
    ).toBe("VENCIDA");
    expect(formatPlanningAmount(BigInt(0))).toBe("A definir");
    expect(canMarkPlanningItemPaid({ amountCents: BigInt(0), visualStatus: "A_DEFINIR" })).toBe(false);
    expect(canMarkPlanningItemPaid({ amountCents: BigInt(100), visualStatus: "PENDENTE" })).toBe(true);
  });

  it("excludes transfers and card or debt payments from bills", () => {
    expect(isExcludedPlanningBillTransaction({ type: "TRANSFER" })).toBe(true);
    expect(isExcludedPlanningBillTransaction({ type: "EXPENSE", origin: "CARD_PAYMENT", budgetImpact: false })).toBe(
      true,
    );
    expect(isExcludedPlanningBillTransaction({ type: "EXPENSE", origin: "DEBT_PAYMENT" })).toBe(true);
    expect(isExcludedPlanningBillTransaction({ type: "EXPENSE", origin: "MANUAL", budgetImpact: true })).toBe(false);
  });

  it("copies only unpaid manual reminders", () => {
    expect(
      isCopyablePlanningTransaction({
        type: "EXPENSE",
        status: "PLANNED",
        origin: "MANUAL",
        budgetImpact: true,
        recurringRuleId: null,
      }),
    ).toBe(true);
    expect(
      isCopyablePlanningTransaction({
        type: "EXPENSE",
        status: "PAID",
        origin: "MANUAL",
      }),
    ).toBe(false);
    expect(
      isCopyablePlanningTransaction({
        type: "EXPENSE",
        status: "PLANNED",
        origin: "MANUAL",
        recurringRuleId: "rule-1",
      }),
    ).toBe(false);
  });

  it("shifts the day to the last valid day of a shorter month", () => {
    expect(shiftIsoDateToMonth("2026-01-31", 2026, 2)).toBe("2026-02-28");
    expect(planningCopyKey("abc", 2026, 9)).toBe("copy:abc:2026-09");
  });

  it("keeps leftover planned investment out of already represented amounts", () => {
    expect(
      investmentRemainderCents({
        plannedCents: BigInt(400_00),
        representedCents: BigInt(100_00),
      }),
    ).toBe(BigInt(300_00));
  });

  it("allows a planned zero amount and rejects a paid zero amount", () => {
    expect(
      transactionFormSchema.safeParse({
        type: "EXPENSE",
        description: "Luz a definir",
        amount: "0,00",
        accountId: "acc",
        transactionDate: "2026-09-01",
        status: "PLANNED",
      }).success,
    ).toBe(true);
    expect(
      transactionFormSchema.safeParse({
        type: "EXPENSE",
        description: "Luz paga",
        amount: "0,00",
        accountId: "acc",
        transactionDate: "2026-09-01",
        status: "PAID",
      }).success,
    ).toBe(false);
  });
});

describe("planner date presentation", () => {
  it("formats competence dates as a short day and month", async () => {
    const { formatPlannerDate } = await import("@/features/planning/planner-transaction-row");
    expect(formatPlannerDate("2026-09-10")).toBe("10 set");
    expect(formatPlannerDate("2026-01-01")).toBe("1 jan");
    expect(formatPlannerDate(null)).toBe("—");
  });
});

describe("planner list view", () => {
  it("filters unpaid items and sorts paid first or by amount", async () => {
    const { applyPlannerListView } = await import("@/features/planning/planner-list-view");
    const items = [
      { id: "1", description: "Aluguel", visualStatus: "PAGA" as const, amountCents: "300000", sortDate: "2026-09-10" },
      { id: "2", description: "Guarda", visualStatus: "PREVISTA" as const, amountCents: "4000", sortDate: "2026-09-05" },
      { id: "3", description: "Luz", visualStatus: "VENCIDA" as const, amountCents: "15000", sortDate: "2026-09-02" },
    ];

    expect(applyPlannerListView(items, "UNPAID", "DATE").map((item) => item.description)).toEqual(["Luz", "Guarda"]);
    expect(applyPlannerListView(items, "ALL", "PAID_FIRST").map((item) => item.description)).toEqual([
      "Aluguel",
      "Luz",
      "Guarda",
    ]);
    expect(applyPlannerListView(items, "ALL", "AMOUNT_ASC").map((item) => item.description)).toEqual([
      "Guarda",
      "Luz",
      "Aluguel",
    ]);
  });
});

describe("planner status labels", () => {
  it("uses the quick paid and received copy", async () => {
    const { statusLabel } = await import("@/features/planning/planner-status-toggle");
    expect(statusLabel("expense", "PREVISTA")).toBe("Não paga");
    expect(statusLabel("expense", "PAGA")).toBe("Paga");
    expect(statusLabel("expense", "VENCIDA")).toBe("Atrasada");
    expect(statusLabel("income", "PREVISTA")).toBe("Não recebida");
    expect(statusLabel("income", "PAGA")).toBe("Recebida");
    expect(statusLabel("income", "PENDENTE")).toBe("Não recebida");
  });
});
