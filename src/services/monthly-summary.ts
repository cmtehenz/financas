import { cardBudgetForMonth, monthlyCardCommitments, peakCommitmentMonth } from "@/domain/cards";
import {
  availableBalance,
  budgetAlertLevel,
  budgetPercent,
  countsTowardBudget,
  currentAccountBalance,
  currentHouseholdBalance,
  investmentReserve,
  investmentTotals,
  paidInMonth,
  pendingExpensesThrough,
  pendingIncomeThrough,
  ZERO_CENTS,
  type LedgerTransaction,
} from "@/domain/ledger";
import { dateInSaoPaulo, monthEnd, yearMonth } from "@/lib/dates";
import { addCents, formatBRL } from "@/lib/money";
import type { Cents } from "@/types/money";

import { listHouseholdAccounts } from "./accounts";
import { getMonthlyBudget } from "./budgets";
import { householdCardState } from "./cards";
import { listHouseholdCategories } from "./categories";
import { householdDebtState, pendingDebtThrough } from "./debts";
import { listHouseholdMembers } from "./households";
import { hasPendingInvitation, listHouseholdInvitations } from "./invitations";
import { listAllHouseholdTransactions } from "./transactions";

function toLedger(transaction: Awaited<ReturnType<typeof listAllHouseholdTransactions>>[number]): LedgerTransaction {
  return {
    id: transaction.id,
    householdId: transaction.householdId,
    accountId: transaction.accountId,
    destinationAccountId: transaction.destinationAccountId,
    categoryId: transaction.categoryId,
    description: transaction.description,
    type: transaction.type as LedgerTransaction["type"],
    amountCents: transaction.amountCents,
    status: transaction.status as LedgerTransaction["status"],
    origin: transaction.origin as LedgerTransaction["origin"],
    budgetImpact: transaction.budgetImpact,
    transactionDate: transaction.transactionDate,
    dueDate: transaction.dueDate,
    paidAt: transaction.paidAt,
    deletedAt: transaction.deletedAt,
  };
}

function paidAtDate(transaction: LedgerTransaction) {
  return transaction.paidAt ? dateInSaoPaulo(transaction.paidAt) : null;
}

export async function getMonthlySummary(householdId: string, year: number, month: number) {
  const monthKey = yearMonth(year, month);
  const throughDate = monthEnd(year, month);
  const [accounts, categories, rawTransactions, members, invitations, budgetState, cardState, debtState] =
    await Promise.all([
      listHouseholdAccounts(householdId),
      listHouseholdCategories(householdId),
      listAllHouseholdTransactions(householdId),
      listHouseholdMembers(householdId),
      listHouseholdInvitations(householdId),
      getMonthlyBudget(householdId, year, month),
      householdCardState(householdId, throughDate),
      householdDebtState(householdId),
    ]);

  const ledgerAccounts = accounts.map((account) => ({
    id: account.id,
    openingBalanceCents: account.openingBalanceCents,
    active: account.active,
    deletedAt: account.deletedAt,
    name: account.name,
  }));
  const txs = rawTransactions.map(toLedger);
  const ledgerCategories = categories.map((category) => ({
    id: category.id,
    householdId: category.householdId,
    type: category.type as "INCOME" | "EXPENSE",
    kind: category.kind as "FIXED" | "VARIABLE" | "DEBT" | "INVESTMENT" | "OTHER",
    name: category.name,
  }));

  const accountBalances = ledgerAccounts.map((account) => ({
    id: account.id,
    name: account.name,
    active: account.active,
    balanceCents: currentAccountBalance(account, txs),
  }));

  const purchaseById = new Map(cardState.purchases.map((item) => [item.id, item]));
  const currentHouseholdCents = currentHouseholdBalance(ledgerAccounts, txs);
  const pendingIncomeCents = pendingIncomeThrough(txs, throughDate);
  const pendingDebtCents = pendingDebtThrough(debtState.installments, throughDate);
  const pendingExpenseCents = addCents(pendingExpensesThrough(txs, throughDate), pendingDebtCents);
  const paidIncomeCents = paidInMonth(txs, { type: "INCOME", yearMonth: monthKey, paidAtDate });
  const paidExpenseCents = paidInMonth(txs, { type: "EXPENSE", yearMonth: monthKey, paidAtDate });
  const investment = investmentTotals(txs, ledgerCategories, {
    yearMonth: monthKey,
    throughDate,
    paidAtDate,
  });
  const plannedInvestmentCents = budgetState.budget?.plannedInvestmentCents ?? ZERO_CENTS;
  const reserveCents = investmentReserve({
    plannedCents: plannedInvestmentCents,
    realizedCents: investment.realized,
    pendingPostedCents: investment.pendingPosted,
  });
  const unpaidCardStatementsCents = cardState.unpaidThroughMonthCents;
  const availableCents = availableBalance({
    currentHouseholdCents,
    pendingIncomeCents,
    pendingExpenseCents,
    investmentReserveCents: reserveCents,
    unpaidCardStatementsCents,
  });

  const expenseByCategory = ledgerCategories
    .filter((category) => category.type === "EXPENSE")
    .map((category) => {
      const realized = addCents(
        ...txs
          .filter(
            (transaction) =>
              countsTowardBudget(transaction) &&
              transaction.categoryId === category.id &&
              transaction.type === "EXPENSE" &&
              transaction.status === "PAID" &&
              (paidAtDate(transaction) ?? transaction.transactionDate).startsWith(monthKey),
          )
          .map((transaction) => transaction.amountCents),
      );
      const committed = addCents(
        ...txs
          .filter((transaction) => {
            if (
              !countsTowardBudget(transaction) ||
              transaction.categoryId !== category.id ||
              transaction.type !== "EXPENSE"
            ) {
              return false;
            }

            if (transaction.status !== "PLANNED" && transaction.status !== "PENDING") {
              return false;
            }

            const date = transaction.dueDate ?? transaction.transactionDate;
            return date.startsWith(monthKey);
          })
          .map((transaction) => transaction.amountCents),
        cardBudgetForMonth(
          cardState.installments
            .filter((item) => purchaseById.get(item.purchaseId)?.categoryId === category.id)
            .map((item) => ({
              amountCents: item.amountCents,
              referenceYear: item.referenceYear,
              referenceMonth: item.referenceMonth,
              purchaseActive: purchaseById.get(item.purchaseId)?.status === "ACTIVE",
            })),
          year,
          month,
        ),
        ...debtState.installments
          .filter((item) => {
            const debt = debtState.debts.find((row) => row.id === item.debtId);
            return (
              debt?.categoryId === category.id &&
              (item.status === "PENDING" || item.status === "OVERDUE") &&
              item.dueDate.startsWith(monthKey)
            );
          })
          .map((item) => item.amountCents),
      );
      const used = addCents(realized, committed);
      const limit = budgetState.limits.find((item) => item.categoryId === category.id)?.limitCents ?? ZERO_CENTS;
      const percent = budgetPercent(used, limit);

      return {
        categoryId: category.id,
        name: category.name,
        kind: category.kind,
        realizedCents: realized,
        committedCents: committed,
        usedCents: used,
        limitCents: limit,
        percent,
        alert: budgetAlertLevel(percent),
      };
    });

  const upcoming = txs
    .filter(
      (transaction) =>
        (transaction.status === "PLANNED" || transaction.status === "PENDING") &&
        transaction.type === "EXPENSE",
    )
    .sort((left, right) => (left.dueDate ?? left.transactionDate).localeCompare(right.dueDate ?? right.transactionDate))
    .slice(0, 5);

  const evolution = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 - (5 - index), 1));
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    return {
      month: key,
      incomeCents: paidInMonth(txs, { type: "INCOME", yearMonth: key, paidAtDate }),
      expenseCents: paidInMonth(txs, { type: "EXPENSE", yearMonth: key, paidAtDate }),
    };
  });

  const budgetUsedCents = addCents(...expenseByCategory.map((item) => item.usedCents));
  const budgetLimitCents = addCents(...expenseByCategory.map((item) => item.limitCents));
  const today = dateInSaoPaulo(new Date());
  const statementsThisMonth = cardState.statements.filter((item) => item.dueDate.startsWith(monthKey));
  const futureStatements = cardState.statements.filter((item) => item.dueDate > throughDate);
  const debtsThisMonth = debtState.installments.filter(
    (item) =>
      (item.status === "PENDING" || item.status === "OVERDUE") && item.dueDate.startsWith(monthKey),
  );
  const overdueAlerts = [
    ...cardState.statements
      .filter((item) => item.pendingCents > ZERO_CENTS && item.dueDate < today)
      .map((item) => ({ kind: "statement" as const, id: item.id, dueDate: item.dueDate, amountCents: item.pendingCents })),
    ...debtState.installments
      .filter((item) => item.status === "OVERDUE" || (item.status === "PENDING" && item.dueDate < today))
      .map((item) => ({ kind: "debt" as const, id: item.id, dueDate: item.dueDate, amountCents: item.amountCents })),
  ];
  const cardCommitments = monthlyCardCommitments(
    cardState.installments.map((item) => ({
      amountCents: item.amountCents,
      referenceYear: item.referenceYear,
      referenceMonth: item.referenceMonth,
      purchaseActive: purchaseById.get(item.purchaseId)?.status === "ACTIVE",
    })),
    year,
    month,
    12,
  );

  return {
    year,
    month,
    monthKey,
    availableCents,
    availableLabel: formatBRL(availableCents),
    currentHouseholdCents,
    currentHouseholdLabel: formatBRL(currentHouseholdCents),
    paidIncomeCents,
    pendingIncomeCents,
    paidExpenseCents,
    pendingExpenseCents,
    plannedInvestmentCents,
    realizedInvestmentCents: investment.realized,
    pendingInvestmentCents: investment.pendingPosted,
    reserveCents,
    accountBalances,
    expenseByCategory,
    upcoming,
    evolution,
    budgetUsedCents,
    budgetLimitCents,
    budgetPercent: budgetPercent(budgetUsedCents, budgetLimitCents),
    members,
    categoryCount: categories.length,
    accountCount: accounts.filter((account) => account.active).length,
    memberCount: members.length,
    hasPendingInvite: hasPendingInvitation(invitations),
    budget: budgetState.budget,
    categories,
    accounts,
    unpaidCardStatementsCents,
    pendingDebtCents,
    cardUsedCents: cardState.usedCents,
    cardAvailableLimitCents: cardState.availableLimitCents,
    statementsThisMonth,
    futureStatements,
    debtsThisMonth,
    debtOutstandingCents: debtState.outstandingCents,
    cardCommitments,
    peakCardCommitment: peakCommitmentMonth(cardCommitments),
    overdueAlerts,
  };
}

export function formatCentsLabel(cents: Cents) {
  return formatBRL(cents);
}
