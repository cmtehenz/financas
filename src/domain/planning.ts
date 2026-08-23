import { addMonths, occurrenceDate, parseIsoDate, parseYearMonth, todayInSaoPaulo, yearMonth } from "@/lib/dates";
import { addCents, formatBRL, subtractCents } from "@/lib/money";
import type { Cents } from "@/types/money";

import { ZERO_CENTS } from "./ledger";

export const PLANNING_MONTH_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

export const PLANNING_BILL_ORIGINS = ["LEDGER", "CARD", "DEBT", "INVESTMENT", "RECURRING"] as const;
export type PlanningBillOrigin = (typeof PLANNING_BILL_ORIGINS)[number];

export const PLANNING_BILL_ORIGIN_LABELS: Record<PlanningBillOrigin, string> = {
  LEDGER: "Conta",
  CARD: "Cartão",
  DEBT: "Dívida",
  INVESTMENT: "Investimento",
  RECURRING: "Recorrente",
};

export const PLANNING_VISUAL_STATUSES = [
  "A_DEFINIR",
  "PREVISTA",
  "PENDENTE",
  "PAGA",
  "VENCIDA",
  "CANCELADA",
] as const;
export type PlanningVisualStatus = (typeof PLANNING_VISUAL_STATUSES)[number];

export const PLANNING_VISUAL_STATUS_LABELS: Record<PlanningVisualStatus, string> = {
  A_DEFINIR: "A definir",
  PREVISTA: "Prevista",
  PENDENTE: "Pendente",
  PAGA: "Paga",
  VENCIDA: "Vencida",
  CANCELADA: "Cancelada",
};

export const PLANNING_INCOME_STATUS_LABELS: Record<PlanningVisualStatus, string> = {
  A_DEFINIR: "A definir",
  PREVISTA: "Prevista",
  PENDENTE: "Pendente",
  PAGA: "Recebida",
  VENCIDA: "Vencida",
  CANCELADA: "Cancelada",
};

/**
 * `amount_cents` is never null. `0` means “A definir” for PLANNED/PENDING only.
 * PAID always requires a positive amount. Do not treat null and zero as equivalent.
 */
export function isUndefinedPlanningAmount(amountCents: Cents) {
  return amountCents === ZERO_CENTS;
}

export function formatPlanningAmount(amountCents: Cents) {
  if (isUndefinedPlanningAmount(amountCents)) {
    return "A definir";
  }

  return formatBRL(amountCents);
}

export function planningCompetenceDate(item: { dueDate: string | null; transactionDate: string }) {
  return item.dueDate ?? item.transactionDate;
}

export function belongsToPlanningMonth(date: string, year: number, month: number) {
  return date.startsWith(yearMonth(year, month));
}

export function parsePlanningSearchParams(
  search: { ano?: string; mes?: string },
  today = todayInSaoPaulo(),
) {
  const fallback = parseYearMonth(today.slice(0, 7), today);
  const year = Number(search.ano);
  const month = Number(search.mes);

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return fallback;
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return fallback;
  }

  return { year, month };
}

export function planningPath(year: number, month: number) {
  return `/planejamento?ano=${year}&mes=${month}`;
}

export function shiftIsoDateToMonth(isoDate: string, year: number, month: number) {
  const { day } = parseIsoDate(isoDate);
  return occurrenceDate(year, month, day);
}

export function planningCopyKey(sourceTransactionId: string, year: number, month: number) {
  return `copy:${sourceTransactionId}:${yearMonth(year, month)}`;
}

export function previousPlanningMonth(year: number, month: number) {
  return addMonths(year, month, -1);
}

export function derivePlanningStatus(input: {
  amountCents: Cents;
  status: string;
  dueDate: string | null;
  today: string;
  cancelled?: boolean;
  paid?: boolean;
}): PlanningVisualStatus {
  if (input.cancelled || input.status === "CANCELLED" || input.status === "CANCELADA") {
    return "CANCELADA";
  }

  if (input.paid || input.status === "PAID" || input.status === "PAID_OFF" || input.status === "PAGA") {
    return "PAGA";
  }

  if (isUndefinedPlanningAmount(input.amountCents)) {
    return "A_DEFINIR";
  }

  if (input.dueDate && input.dueDate < input.today) {
    return "VENCIDA";
  }

  if (input.status === "PLANNED" || input.status === "PREVISTA" || input.status === "OPEN") {
    return "PREVISTA";
  }

  return "PENDENTE";
}

export function countsTowardPlanningTotal(amountCents: Cents, visualStatus: PlanningVisualStatus) {
  return visualStatus !== "CANCELADA" && !isUndefinedPlanningAmount(amountCents);
}

export function canMarkPlanningItemPaid(input: {
  amountCents: Cents;
  visualStatus: PlanningVisualStatus;
}) {
  return countsTowardPlanningTotal(input.amountCents, input.visualStatus) && input.visualStatus !== "PAGA";
}

export function isExcludedPlanningBillTransaction(item: {
  type: string;
  origin?: string | null;
  budgetImpact?: boolean | null;
}) {
  return (
    item.type === "TRANSFER" ||
    item.origin === "CARD_PAYMENT" ||
    item.origin === "DEBT_PAYMENT" ||
    item.budgetImpact === false
  );
}

export function isCopyablePlanningTransaction(item: {
  type: string;
  status: string;
  origin?: string | null;
  budgetImpact?: boolean | null;
  recurringRuleId?: string | null;
  deletedAt?: Date | null;
}) {
  if (item.deletedAt) {
    return false;
  }

  if (item.status !== "PLANNED" && item.status !== "PENDING") {
    return false;
  }

  if (item.type !== "INCOME" && item.type !== "EXPENSE") {
    return false;
  }

  if (item.recurringRuleId) {
    return false;
  }

  return !isExcludedPlanningBillTransaction(item);
}

export function planningMonthTotals(input: {
  incomes: Array<{ amountCents: Cents; visualStatus: PlanningVisualStatus }>;
  bills: Array<{ amountCents: Cents; paidCents: Cents; visualStatus: PlanningVisualStatus }>;
}) {
  const plannedIncomeCents = addCents(
    ...input.incomes
      .filter((item) => countsTowardPlanningTotal(item.amountCents, item.visualStatus))
      .map((item) => item.amountCents),
  );
  const receivedIncomeCents = addCents(
    ...input.incomes
      .filter((item) => item.visualStatus === "PAGA" && countsTowardPlanningTotal(item.amountCents, item.visualStatus))
      .map((item) => item.amountCents),
  );
  const billsTotalCents = addCents(
    ...input.bills
      .filter((item) => countsTowardPlanningTotal(item.amountCents, item.visualStatus))
      .map((item) => item.amountCents),
  );
  const paidBillsCents = addCents(
    ...input.bills
      .filter((item) => countsTowardPlanningTotal(item.amountCents, item.visualStatus))
      .map((item) => (item.paidCents > item.amountCents ? item.amountCents : item.paidCents)),
  );
  const remainingToPayCents = subtractCents(billsTotalCents, paidBillsCents);
  const plannedBalanceCents = subtractCents(plannedIncomeCents, billsTotalCents);

  return {
    plannedIncomeCents,
    receivedIncomeCents,
    billsTotalCents,
    paidBillsCents,
    remainingToPayCents,
    plannedBalanceCents,
  };
}

export function investmentRemainderCents(input: {
  plannedCents: Cents;
  representedCents: Cents;
}): Cents {
  const remainder = subtractCents(input.plannedCents, input.representedCents);
  return remainder > ZERO_CENTS ? remainder : ZERO_CENTS;
}
