import { addMonths, occurrenceDate, parseIsoDate } from "@/lib/dates";
import { addCents, subtractCents } from "@/lib/money";
import type { Cents } from "@/types/money";

import { splitInstallments } from "./cards";
import { ZERO_CENTS } from "./ledger";

export const DEBT_STATUSES = ["ACTIVE", "PAID_OFF", "NEGOTIATING", "CANCELLED"] as const;
export const DEBT_INSTALLMENT_STATUSES = ["PENDING", "PAID", "OVERDUE", "CANCELLED"] as const;

export type DebtStatus = (typeof DEBT_STATUSES)[number];
export type DebtInstallmentStatus = (typeof DEBT_INSTALLMENT_STATUSES)[number];

export function buildDebtSchedule(input: {
  firstDueDate: string;
  installmentCount: number;
  totalCents: Cents;
  today?: string;
}) {
  const amounts = splitInstallments(input.totalCents, input.installmentCount);
  const first = parseIsoDate(input.firstDueDate);
  const dueDay = first.day;

  return amounts.map((amountCents, index) => {
    const period = addMonths(first.year, first.month, index);
    const dueDate = occurrenceDate(period.year, period.month, dueDay);
    let status: DebtInstallmentStatus = "PENDING";
    if (input.today && dueDate < input.today) {
      status = "OVERDUE";
    }

    return {
      installmentNumber: index + 1,
      dueDate,
      amountCents,
      status,
    };
  });
}

export function debtOutstandingFromSchedule(
  installments: Array<{ amountCents: Cents; status: DebtInstallmentStatus }>,
): Cents {
  return addCents(
    ...installments
      .filter((item) => item.status === "PENDING" || item.status === "OVERDUE")
      .map((item) => item.amountCents),
  );
}

export function deriveDebtStatus(input: {
  cancelled?: boolean;
  negotiating?: boolean;
  outstandingCents: Cents;
}): DebtStatus {
  if (input.cancelled) {
    return "CANCELLED";
  }

  if (input.outstandingCents <= ZERO_CENTS) {
    return "PAID_OFF";
  }

  if (input.negotiating) {
    return "NEGOTIATING";
  }

  return "ACTIVE";
}

export function monthlyReleaseAfterPayoff(installmentAmountCents: Cents | null): Cents {
  return installmentAmountCents && installmentAmountCents > ZERO_CENTS
    ? installmentAmountCents
    : ZERO_CENTS;
}

export function remainingAfterPayment(outstandingCents: Cents, paymentCents: Cents): Cents {
  return outstandingCents > paymentCents
    ? subtractCents(outstandingCents, paymentCents)
    : ZERO_CENTS;
}
