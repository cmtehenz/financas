import { addMonths, occurrenceDate, parseIsoDate, yearMonth } from "@/lib/dates";
import { addCents, subtractCents } from "@/lib/money";
import type { Cents } from "@/types/money";

import { ZERO_CENTS } from "./ledger";

export const CARD_STATEMENT_STATUSES = ["OPEN", "CLOSED", "PARTIALLY_PAID", "PAID", "CANCELLED"] as const;
export type CardStatementStatus = (typeof CARD_STATEMENT_STATUSES)[number];

export function splitInstallments(totalCents: Cents, count: number): Cents[] {
  if (count < 1) {
    throw new Error("INSTALLMENT_COUNT");
  }

  if (totalCents <= ZERO_CENTS) {
    throw new Error("INVALID_AMOUNT");
  }

  const size = BigInt(count);
  const base = totalCents / size;
  const remainder = Number(totalCents % size);

  return Array.from({ length: count }, (_, index) => (base + BigInt(index < remainder ? 1 : 0)) as Cents);
}

export function firstStatementMonth(purchaseDate: string, closingDay: number) {
  const { year, month, day } = parseIsoDate(purchaseDate);
  const closingThisMonth = Number(occurrenceDate(year, month, closingDay).slice(8, 10));

  if (day <= closingThisMonth) {
    return { year, month };
  }

  return addMonths(year, month, 1);
}

export function dueDateForStatement(
  closingYear: number,
  closingMonth: number,
  closingDay: number,
  dueDay: number,
) {
  if (dueDay > closingDay) {
    return occurrenceDate(closingYear, closingMonth, dueDay);
  }

  const next = addMonths(closingYear, closingMonth, 1);
  return occurrenceDate(next.year, next.month, dueDay);
}

export function statementPeriodForInstallment(
  purchaseDate: string,
  closingDay: number,
  dueDay: number,
  installmentIndex: number,
) {
  const first = firstStatementMonth(purchaseDate, closingDay);
  const reference = addMonths(first.year, first.month, installmentIndex);
  return {
    referenceYear: reference.year,
    referenceMonth: reference.month,
    closingDate: occurrenceDate(reference.year, reference.month, closingDay),
    dueDate: dueDateForStatement(reference.year, reference.month, closingDay, dueDay),
    monthKey: yearMonth(reference.year, reference.month),
  };
}

export function previewCardInstallments(input: {
  totalAmountCents: Cents;
  installmentCount: number;
  purchaseDate: string;
  closingDay: number;
  dueDay: number;
}) {
  const amounts = splitInstallments(input.totalAmountCents, input.installmentCount);
  return amounts.map((amountCents, index) => ({
    installmentNumber: index + 1,
    installmentCount: input.installmentCount,
    amountCents,
    ...statementPeriodForInstallment(input.purchaseDate, input.closingDay, input.dueDay, index),
  }));
}

export function statementPendingCents(totalCents: Cents, paidCents: Cents): Cents {
  return (totalCents > paidCents ? subtractCents(totalCents, paidCents) : ZERO_CENTS) as Cents;
}

export function deriveStatementStatus(input: {
  today: string;
  closingDate: string;
  totalCents: Cents;
  paidCents: Cents;
  cancelled?: boolean;
}): CardStatementStatus {
  if (input.cancelled) {
    return "CANCELLED";
  }

  const pending = statementPendingCents(input.totalCents, input.paidCents);
  if (input.totalCents > ZERO_CENTS && pending === ZERO_CENTS) {
    return "PAID";
  }

  if (input.paidCents > ZERO_CENTS && pending > ZERO_CENTS) {
    return "PARTIALLY_PAID";
  }

  if (input.today > input.closingDate) {
    return "CLOSED";
  }

  return "OPEN";
}

export function cardUsedLimitCents(
  items: Array<{ amountCents: Cents; purchaseActive: boolean; statementPendingCents: Cents }>,
): Cents {
  return addCents(
    ...items
      .filter((item) => item.purchaseActive && item.statementPendingCents > ZERO_CENTS)
      .map((item) => item.amountCents),
  );
}

export function cardAvailableLimitCents(limitCents: Cents, usedCents: Cents): Cents {
  return subtractCents(limitCents, usedCents);
}

export function unpaidStatementsThrough(
  statements: Array<{ dueDate: string; pendingCents: Cents }>,
  throughDate: string,
): Cents {
  return addCents(
    ...statements
      .filter((statement) => statement.dueDate <= throughDate && statement.pendingCents > ZERO_CENTS)
      .map((statement) => statement.pendingCents),
  );
}

export function cardBudgetForMonth(
  installments: Array<{
    amountCents: Cents;
    referenceYear: number;
    referenceMonth: number;
    purchaseActive: boolean;
  }>,
  year: number,
  month: number,
): Cents {
  return addCents(
    ...installments
      .filter(
        (item) =>
          item.purchaseActive && item.referenceYear === year && item.referenceMonth === month,
      )
      .map((item) => item.amountCents),
  );
}

export function monthlyCardCommitments(
  installments: Array<{
    amountCents: Cents;
    referenceYear: number;
    referenceMonth: number;
    purchaseActive: boolean;
  }>,
  startYear: number,
  startMonth: number,
  months = 12,
) {
  return Array.from({ length: months }, (_, index) => {
    const period = addMonths(startYear, startMonth, index);
    return {
      monthKey: yearMonth(period.year, period.month),
      year: period.year,
      month: period.month,
      amountCents: cardBudgetForMonth(installments, period.year, period.month),
    };
  });
}

export function peakCommitmentMonth(items: Array<{ monthKey: string; amountCents: Cents }>) {
  return items.reduce<(typeof items)[number] | null>((highest, item) => {
    if (!highest || item.amountCents > highest.amountCents) {
      return item;
    }

    return highest;
  }, null);
}
