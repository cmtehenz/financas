import { addCents, formatBRL } from "@/lib/money";
import type { Cents } from "@/types/money";
import {
  belongsToPlanningMonth,
  canMarkPlanningItemPaid,
  derivePlanningStatus,
  formatPlanningAmount,
  investmentRemainderCents,
  isCopyablePlanningTransaction,
  isExcludedPlanningBillTransaction,
  PLANNING_BILL_ORIGIN_LABELS,
  PLANNING_INCOME_STATUS_LABELS,
  PLANNING_MONTH_LABELS,
  PLANNING_VISUAL_STATUS_LABELS,
  planningCompetenceDate,
  planningCopyKey,
  planningMonthTotals,
  previousPlanningMonth,
  shiftIsoDateToMonth,
  type PlanningBillOrigin,
  type PlanningVisualStatus,
} from "@/domain/planning";
import { ZERO_CENTS } from "@/domain/ledger";
import { todayInSaoPaulo, yearMonth } from "@/lib/dates";

import { recordAudit } from "./audit";
import { listHouseholdAccounts } from "./accounts";
import { getMonthlyBudget } from "./budgets";
import { householdCardState } from "./cards";
import { listHouseholdCategories } from "./categories";
import { householdDebtState } from "./debts";
import { assertHouseholdAccessForUser, listHouseholdMembers } from "./households";
import { getMonthlySummary } from "./monthly-summary";
import { createRecurringRule } from "./recurrences";
import {
  createTransaction,
  listAllHouseholdTransactions,
  settleLedgerPlanningItem,
} from "./transactions";

export class PlanningError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "DUPLICATE_COPY" | "EMPTY_COPY" | "INVALID_ITEM" | "UNDEFINED_AMOUNT",
  ) {
    super(message);
    this.name = "PlanningError";
  }
}

export type PlanningIncomeRow = {
  id: string;
  description: string;
  expectedDate: string;
  expectedDateLabel: string;
  assigneeName: string;
  accountName: string;
  accountId: string;
  amountCents: string;
  amountLabel: string;
  visualStatus: PlanningVisualStatus;
  statusLabel: string;
  canReceive: boolean;
  recurring: boolean;
};

export type PlanningBillRow = {
  id: string;
  sourceId: string;
  description: string;
  origin: PlanningBillOrigin;
  originLabel: string;
  dueDate: string | null;
  dueDateLabel: string;
  assigneeName: string;
  amountCents: string;
  paidCents: string;
  amountLabel: string;
  visualStatus: PlanningVisualStatus;
  statusLabel: string;
  canPay: boolean;
  statementId?: string;
  pendingLabel?: string;
  debtId?: string;
  installmentId?: string;
};

export type PlanningCopyPreviewItem = {
  id: string;
  description: string;
  type: "INCOME" | "EXPENSE";
  amountLabel: string;
  alreadyCopied: boolean;
};

export type MonthlyPlanningBoard = {
  year: number;
  month: number;
  monthKey: string;
  monthLabel: string;
  incomes: PlanningIncomeRow[];
  bills: PlanningBillRow[];
  totals: {
    plannedIncomeLabel: string;
    receivedIncomeLabel: string;
    billsTotalLabel: string;
    paidBillsLabel: string;
    remainingToPayLabel: string;
    plannedBalanceLabel: string;
    plannedBalanceCents: string;
    availableLabel: string;
  };
  copyPreview: PlanningCopyPreviewItem[];
  empty: boolean;
};

function sortByDate(left: string | null, right: string | null) {
  if (!left && !right) {
    return 0;
  }
  if (!left) {
    return 1;
  }
  if (!right) {
    return -1;
  }
  return left.localeCompare(right);
}

function dueDateLabel(dueDate: string | null) {
  return dueDate ? dueDate.split("-").reverse().join("/") : "Sem vencimento";
}

export async function getMonthlyPlanningBoard(
  input: { userId: string; householdId: string; year: number; month: number },
): Promise<MonthlyPlanningBoard> {
  await assertHouseholdAccessForUser(input.userId, input.householdId);
  const today = todayInSaoPaulo();
  const monthKey = yearMonth(input.year, input.month);
  const throughDate = `${monthKey}-28`;
  const [
    summary,
    accounts,
    categories,
    members,
    rawTransactions,
    cardState,
    debtState,
    budgetState,
  ] = await Promise.all([
    getMonthlySummary(input.householdId, input.year, input.month),
    listHouseholdAccounts(input.householdId),
    listHouseholdCategories(input.householdId),
    listHouseholdMembers(input.householdId),
    listAllHouseholdTransactions(input.householdId),
    householdCardState(input.householdId, throughDate),
    householdDebtState(input.householdId),
    getMonthlyBudget(input.householdId, input.year, input.month),
  ]);

  const accountById = new Map(accounts.map((account) => [account.id, account.name]));
  const memberById = new Map(members.map((member) => [member.userId, member.name]));
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const cardById = new Map(cardState.cards.map((card) => [card.id, card.name]));
  const debtById = new Map(debtState.debts.map((debt) => [debt.id, debt]));

  const monthTransactions = rawTransactions.filter((item) =>
    belongsToPlanningMonth(planningCompetenceDate(item), input.year, input.month),
  );

  const incomes: PlanningIncomeRow[] = monthTransactions
    .filter((item) => item.type === "INCOME")
    .map((item) => {
      const visualStatus = derivePlanningStatus({
        amountCents: item.amountCents,
        status: item.status,
        dueDate: item.dueDate,
        today,
      });
      return {
        id: item.id,
        description: item.description,
        expectedDate: item.dueDate ?? item.transactionDate,
        expectedDateLabel: dueDateLabel(item.dueDate ?? item.transactionDate),
        assigneeName: item.assignedToUserId ? (memberById.get(item.assignedToUserId) ?? "Membro") : "Compartilhado",
        accountName: accountById.get(item.accountId) ?? "Conta",
        accountId: item.accountId,
        amountCents: item.amountCents.toString(),
        amountLabel: formatPlanningAmount(item.amountCents),
        visualStatus,
        statusLabel: PLANNING_INCOME_STATUS_LABELS[visualStatus],
        canReceive: canMarkPlanningItemPaid({ amountCents: item.amountCents, visualStatus }),
        recurring: Boolean(item.recurringRuleId),
      };
    })
    .sort((left, right) => sortByDate(left.expectedDate, right.expectedDate) || left.description.localeCompare(right.description));

  const ledgerBills: PlanningBillRow[] = monthTransactions
    .filter((item) => item.type === "EXPENSE" && !isExcludedPlanningBillTransaction(item))
    .map((item) => {
      const category = item.categoryId ? categoryById.get(item.categoryId) : undefined;
      const origin: PlanningBillOrigin = item.recurringRuleId
        ? "RECURRING"
        : category?.kind === "INVESTMENT"
          ? "INVESTMENT"
          : "LEDGER";
      const visualStatus = derivePlanningStatus({
        amountCents: item.amountCents,
        status: item.status,
        dueDate: item.dueDate,
        today,
      });
      const paidCents = item.status === "PAID" ? item.amountCents : ZERO_CENTS;
      return {
        id: `ledger:${item.id}`,
        sourceId: item.id,
        description: item.description,
        origin,
        originLabel: PLANNING_BILL_ORIGIN_LABELS[origin],
        dueDate: item.dueDate,
        dueDateLabel: dueDateLabel(item.dueDate),
        assigneeName: item.assignedToUserId ? (memberById.get(item.assignedToUserId) ?? "Membro") : "Compartilhado",
        amountCents: item.amountCents.toString(),
        paidCents: paidCents.toString(),
        amountLabel: formatPlanningAmount(item.amountCents),
        visualStatus,
        statusLabel: PLANNING_VISUAL_STATUS_LABELS[visualStatus],
        canPay: canMarkPlanningItemPaid({ amountCents: item.amountCents, visualStatus }),
      };
    });

  const cardBills: PlanningBillRow[] = cardState.statements
    .filter((statement) => statement.status !== "CANCELLED" && belongsToPlanningMonth(statement.dueDate, input.year, input.month))
    .filter((statement) => statement.totalCents > ZERO_CENTS || statement.pendingCents > ZERO_CENTS)
    .map((statement) => {
      const visualStatus = derivePlanningStatus({
        amountCents: statement.totalCents,
        status: statement.status,
        dueDate: statement.dueDate,
        today,
        paid: statement.pendingCents === ZERO_CENTS && statement.totalCents > ZERO_CENTS,
      });
      return {
        id: `card:${statement.id}`,
        sourceId: statement.id,
        description: `Fatura ${cardById.get(statement.creditCardId) ?? "cartão"}`,
        origin: "CARD" as const,
        originLabel: PLANNING_BILL_ORIGIN_LABELS.CARD,
        dueDate: statement.dueDate,
        dueDateLabel: dueDateLabel(statement.dueDate),
        assigneeName: "Compartilhado",
        amountCents: statement.totalCents.toString(),
        paidCents: statement.paidCents.toString(),
        amountLabel: formatPlanningAmount(statement.totalCents),
        visualStatus,
        statusLabel: PLANNING_VISUAL_STATUS_LABELS[visualStatus],
        canPay: statement.pendingCents > ZERO_CENTS,
        statementId: statement.id,
        pendingLabel: formatBRL(statement.pendingCents),
      };
    });

  const debtBills: PlanningBillRow[] = debtState.installments
    .filter((installment) => installment.status !== "CANCELLED" && belongsToPlanningMonth(installment.dueDate, input.year, input.month))
    .map((installment) => {
      const debt = debtById.get(installment.debtId);
      const visualStatus = derivePlanningStatus({
        amountCents: installment.amountCents,
        status: installment.status,
        dueDate: installment.dueDate,
        today,
        paid: installment.status === "PAID" || Boolean(installment.paymentTransactionId),
      });
      const paidCents = visualStatus === "PAGA" ? installment.amountCents : ZERO_CENTS;
      return {
        id: `debt:${installment.id}`,
        sourceId: installment.id,
        description: debt
          ? `${debt.name} ${installment.installmentNumber}/${debt.totalInstallments ?? installment.installmentNumber}`
          : "Parcela de dívida",
        origin: "DEBT" as const,
        originLabel: PLANNING_BILL_ORIGIN_LABELS.DEBT,
        dueDate: installment.dueDate,
        dueDateLabel: dueDateLabel(installment.dueDate),
        assigneeName: "Compartilhado",
        amountCents: installment.amountCents.toString(),
        paidCents: paidCents.toString(),
        amountLabel: formatPlanningAmount(installment.amountCents),
        visualStatus,
        statusLabel: PLANNING_VISUAL_STATUS_LABELS[visualStatus],
        canPay: visualStatus !== "PAGA" && visualStatus !== "CANCELADA",
        debtId: installment.debtId,
        installmentId: installment.id,
      };
    });

  const representedInvestment = addCents(
    ...monthTransactions
      .filter((item) => {
        if (item.type !== "EXPENSE" || item.status === "CANCELLED") {
          return false;
        }
        const category = item.categoryId ? categoryById.get(item.categoryId) : undefined;
        return category?.kind === "INVESTMENT" && item.amountCents > ZERO_CENTS;
      })
      .map((item) => item.amountCents),
  );
  const remainder = investmentRemainderCents({
    plannedCents: budgetState.budget?.plannedInvestmentCents ?? ZERO_CENTS,
    representedCents: representedInvestment,
  });
  const investmentBills: PlanningBillRow[] =
    remainder > ZERO_CENTS
      ? [
          {
            id: `investment:${input.householdId}:${monthKey}`,
            sourceId: `investment:${monthKey}`,
            description: "Investimento planejado",
            origin: "INVESTMENT",
            originLabel: PLANNING_BILL_ORIGIN_LABELS.INVESTMENT,
            dueDate: null,
            dueDateLabel: "Sem vencimento",
            assigneeName: "Compartilhado",
            amountCents: remainder.toString(),
            paidCents: "0",
            amountLabel: formatPlanningAmount(remainder),
            visualStatus: "PREVISTA",
            statusLabel: PLANNING_VISUAL_STATUS_LABELS.PREVISTA,
            canPay: true,
          },
        ]
      : [];

  const bills = [...ledgerBills, ...cardBills, ...debtBills, ...investmentBills].sort(
    (left, right) => sortByDate(left.dueDate, right.dueDate) || left.description.localeCompare(right.description),
  );

  const totals = planningMonthTotals({
    incomes: incomes.map((item) => ({
      amountCents: BigInt(item.amountCents),
      visualStatus: item.visualStatus,
    })),
    bills: bills.map((item) => ({
      amountCents: BigInt(item.amountCents),
      paidCents: BigInt(item.paidCents),
      visualStatus: item.visualStatus,
    })),
  });

  const previous = previousPlanningMonth(input.year, input.month);
  const copyPreview = await listCopyablePlanningTransactions({
    householdId: input.householdId,
    year: previous.year,
    month: previous.month,
    targetYear: input.year,
    targetMonth: input.month,
    transactions: rawTransactions,
  });

  return {
    year: input.year,
    month: input.month,
    monthKey,
    monthLabel: `${PLANNING_MONTH_LABELS[input.month - 1]} de ${input.year}`,
    incomes,
    bills,
    totals: {
      plannedIncomeLabel: formatBRL(totals.plannedIncomeCents),
      receivedIncomeLabel: formatBRL(totals.receivedIncomeCents),
      billsTotalLabel: formatBRL(totals.billsTotalCents),
      paidBillsLabel: formatBRL(totals.paidBillsCents),
      remainingToPayLabel: formatBRL(totals.remainingToPayCents),
      plannedBalanceLabel: formatBRL(totals.plannedBalanceCents),
      plannedBalanceCents: totals.plannedBalanceCents.toString(),
      availableLabel: summary.availableLabel,
    },
    copyPreview,
    empty: incomes.length === 0 && bills.length === 0,
  };
}

async function listCopyablePlanningTransactions(input: {
  householdId: string;
  year: number;
  month: number;
  targetYear: number;
  targetMonth: number;
  transactions: Awaited<ReturnType<typeof listAllHouseholdTransactions>>;
}): Promise<PlanningCopyPreviewItem[]> {
  const existingKeys = new Set(
    input.transactions
      .filter((item) => item.householdId === input.householdId && item.planningCopyKey)
      .map((item) => item.planningCopyKey),
  );

  return input.transactions
    .filter(
      (item) =>
        isCopyablePlanningTransaction(item) &&
        belongsToPlanningMonth(planningCompetenceDate(item), input.year, input.month),
    )
    .map((item) => ({
      id: item.id,
      description: item.description,
      type: item.type as "INCOME" | "EXPENSE",
      amountLabel: formatPlanningAmount(item.amountCents),
      alreadyCopied: existingKeys.has(planningCopyKey(item.id, input.targetYear, input.targetMonth)),
    }));
}

export async function copyPreviousMonthPlanning(input: {
  userId: string;
  householdId: string;
  year: number;
  month: number;
  transactionIds: string[];
}) {
  await assertHouseholdAccessForUser(input.userId, input.householdId);
  const previous = previousPlanningMonth(input.year, input.month);
  const transactions = await listAllHouseholdTransactions(input.householdId);
  const selected = new Set(input.transactionIds);
  const copyable = transactions.filter(
    (item) =>
      selected.has(item.id) &&
      isCopyablePlanningTransaction(item) &&
      belongsToPlanningMonth(planningCompetenceDate(item), previous.year, previous.month),
  );

  if (copyable.length === 0) {
    throw new PlanningError("Nenhum item elegível para copiar.", "EMPTY_COPY");
  }

  if (copyable.length !== input.transactionIds.length) {
    throw new PlanningError("Um ou mais itens não podem ser copiados.", "INVALID_ITEM");
  }

  const existingKeys = new Set(transactions.map((item) => item.planningCopyKey).filter(Boolean));
  const pending = copyable.filter(
    (item) => !existingKeys.has(planningCopyKey(item.id, input.year, input.month)),
  );

  if (pending.length === 0) {
    throw new PlanningError("Este planejamento já foi copiado para o mês.", "DUPLICATE_COPY");
  }

  let created = 0;
  for (const item of pending) {
    const transactionDate = shiftIsoDateToMonth(item.transactionDate, input.year, input.month);
    const dueDate = item.dueDate ? shiftIsoDateToMonth(item.dueDate, input.year, input.month) : null;
    await createTransaction({
      userId: input.userId,
      householdId: input.householdId,
      type: item.type as "INCOME" | "EXPENSE",
      description: item.description,
      amountCents: item.amountCents,
      accountId: item.accountId,
      categoryId: item.categoryId,
      assignedToUserId: item.assignedToUserId,
      transactionDate,
      dueDate,
      status: item.status === "PENDING" ? "PENDING" : "PLANNED",
      notes: item.notes,
      planningCopyKey: planningCopyKey(item.id, input.year, input.month),
    });
    created += 1;
  }

  await recordAudit({
    householdId: input.householdId,
    actorUserId: input.userId,
    action: "planning.copy",
    entityType: "monthly_planning",
    entityId: yearMonth(input.year, input.month),
    changedFields: ["transactionIds"],
  });

  return { created };
}

export async function settlePlanningLedgerItem(input: {
  userId: string;
  householdId: string;
  transactionId: string;
  amountCents: Cents;
  accountId: string;
  paidAt: string;
}) {
  return settleLedgerPlanningItem(input);
}

export async function settleInvestmentRemainder(input: {
  userId: string;
  householdId: string;
  year: number;
  month: number;
  amountCents: Cents;
  accountId: string;
  paidAt: string;
}) {
  await assertHouseholdAccessForUser(input.userId, input.householdId);
  if (input.amountCents <= ZERO_CENTS) {
    throw new PlanningError("Informe um valor maior que zero para investir.", "UNDEFINED_AMOUNT");
  }

  const categories = await listHouseholdCategories(input.householdId);
  const investment = categories.find((category) => category.active && category.kind === "INVESTMENT" && category.type === "EXPENSE");
  if (!investment) {
    throw new PlanningError("Cadastre uma categoria de investimento.", "NOT_FOUND");
  }

  const created = await createTransaction({
    userId: input.userId,
    householdId: input.householdId,
    type: "EXPENSE",
    description: "Investimento planejado",
    amountCents: input.amountCents,
    accountId: input.accountId,
    categoryId: investment.id,
    transactionDate: input.paidAt,
    dueDate: input.paidAt,
    status: "PAID",
  });

  await recordAudit({
    householdId: input.householdId,
    actorUserId: input.userId,
    action: "planning.investment.pay",
    entityType: "transaction",
    entityId: created?.id ?? yearMonth(input.year, input.month),
    changedFields: ["status", "amountCents"],
  });

  return created;
}

export async function makePlanningItemRecurring(input: {
  userId: string;
  householdId: string;
  transactionId: string;
  dueDay: number;
}) {
  await assertHouseholdAccessForUser(input.userId, input.householdId);
  const transactions = await listAllHouseholdTransactions(input.householdId);
  const existing = transactions.find((item) => item.id === input.transactionId);
  if (!existing) {
    throw new PlanningError("Movimentação não encontrada.", "NOT_FOUND");
  }

  if (existing.type !== "INCOME" && existing.type !== "EXPENSE") {
    throw new PlanningError("Somente receita ou despesa pode ser recorrente.", "INVALID_ITEM");
  }

  if (existing.amountCents <= ZERO_CENTS) {
    throw new PlanningError("Informe o valor antes de tornar recorrente.", "UNDEFINED_AMOUNT");
  }

  if (existing.recurringRuleId) {
    throw new PlanningError("Esta movimentação já é recorrente.", "DUPLICATE_COPY");
  }

  return createRecurringRule({
    userId: input.userId,
    householdId: input.householdId,
    accountId: existing.accountId,
    categoryId: existing.categoryId ?? "",
    assignedToUserId: existing.assignedToUserId,
    description: existing.description,
    type: existing.type,
    amountCents: existing.amountCents,
    dueDay: input.dueDay,
    startDate: existing.transactionDate.slice(0, 8) + "01",
    defaultStatus: existing.status === "PENDING" ? "PENDING" : "PLANNED",
  });
}

