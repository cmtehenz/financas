import { addCents, maxCents, subtractCents } from "@/lib/money";
import type { Cents } from "@/types/money";

export const ZERO_CENTS = BigInt(0) as Cents;

export type LedgerTransactionType = "INCOME" | "EXPENSE" | "TRANSFER";
export type LedgerTransactionStatus = "PLANNED" | "PENDING" | "PAID" | "CANCELLED";

export type LedgerAccount = {
  id: string;
  openingBalanceCents: Cents;
  active: boolean;
  deletedAt?: Date | null;
};

export type LedgerCategory = {
  id: string;
  householdId: string;
  type: "INCOME" | "EXPENSE";
  kind: "FIXED" | "VARIABLE" | "DEBT" | "INVESTMENT" | "OTHER";
};

export type LedgerTransaction = {
  id: string;
  householdId: string;
  accountId: string;
  destinationAccountId: string | null;
  categoryId: string | null;
  description?: string;
  type: LedgerTransactionType;
  amountCents: Cents;
  status: LedgerTransactionStatus;
  origin?: "MANUAL" | "CARD_PAYMENT" | "DEBT_PAYMENT";
  budgetImpact?: boolean;
  transactionDate: string;
  dueDate: string | null;
  paidAt: Date | null;
  deletedAt?: Date | null;
};

export function countsTowardBudget(transaction: LedgerTransaction) {
  return transaction.budgetImpact !== false && transaction.origin !== "CARD_PAYMENT";
}

export function isLedgerActive(transaction: LedgerTransaction) {
  return transaction.status !== "CANCELLED" && !transaction.deletedAt;
}

export function isPaidLedger(transaction: LedgerTransaction) {
  return isLedgerActive(transaction) && transaction.status === "PAID";
}

export function isOpenLedger(transaction: LedgerTransaction) {
  return (
    isLedgerActive(transaction) &&
    (transaction.status === "PLANNED" || transaction.status === "PENDING")
  );
}

export function cashflowDate(transaction: LedgerTransaction, paidAtDate: string | null) {
  if (transaction.status === "PAID") {
    return paidAtDate ?? transaction.transactionDate;
  }

  return transaction.dueDate ?? transaction.transactionDate;
}

export function currentAccountBalance(
  account: LedgerAccount,
  transactions: LedgerTransaction[],
): Cents {
  if (account.deletedAt) {
    return ZERO_CENTS;
  }

  let total = account.openingBalanceCents;

  for (const transaction of transactions) {
    if (!isPaidLedger(transaction)) {
      continue;
    }

    if (transaction.type === "INCOME" && transaction.accountId === account.id) {
      total = addCents(total, transaction.amountCents);
      continue;
    }

    if (transaction.type === "EXPENSE" && transaction.accountId === account.id) {
      total = subtractCents(total, transaction.amountCents);
      continue;
    }

    if (transaction.type === "TRANSFER") {
      if (transaction.accountId === account.id) {
        total = subtractCents(total, transaction.amountCents);
      }

      if (transaction.destinationAccountId === account.id) {
        total = addCents(total, transaction.amountCents);
      }
    }
  }

  return total;
}

export function currentHouseholdBalance(
  accounts: LedgerAccount[],
  transactions: LedgerTransaction[],
): Cents {
  return addCents(
    ...accounts
      .filter((account) => account.active && !account.deletedAt)
      .map((account) => currentAccountBalance(account, transactions)),
  );
}

export function sumByTypeThrough(
  transactions: LedgerTransaction[],
  input: {
    type: "INCOME" | "EXPENSE";
    throughDate: string;
    statuses: LedgerTransactionStatus[];
    paidAtDate?: (transaction: LedgerTransaction) => string | null;
    budgetOnly?: boolean;
  },
): Cents {
  return addCents(
    ...transactions
      .filter((transaction) => {
        if (transaction.type !== input.type || !isLedgerActive(transaction)) {
          return false;
        }

        if (input.type === "EXPENSE" && !countsTowardBudget(transaction) && input.budgetOnly) {
          return false;
        }

        if (!input.statuses.includes(transaction.status)) {
          return false;
        }

        const date = cashflowDate(transaction, input.paidAtDate?.(transaction) ?? null);
        return date <= input.throughDate;
      })
      .map((transaction) => transaction.amountCents),
  );
}

export function pendingIncomeThrough(transactions: LedgerTransaction[], throughDate: string): Cents {
  return sumByTypeThrough(transactions, {
    type: "INCOME",
    throughDate,
    statuses: ["PLANNED", "PENDING"],
  });
}

export function pendingExpensesThrough(
  transactions: LedgerTransaction[],
  throughDate: string,
): Cents {
  return sumByTypeThrough(transactions, {
    type: "EXPENSE",
    throughDate,
    statuses: ["PLANNED", "PENDING"],
    budgetOnly: true,
  });
}

export function paidInMonth(
  transactions: LedgerTransaction[],
  input: { type: "INCOME" | "EXPENSE"; yearMonth: string; paidAtDate: (transaction: LedgerTransaction) => string | null },
): Cents {
  return addCents(
    ...transactions
      .filter((transaction) => {
        if (transaction.type !== input.type || !isPaidLedger(transaction)) {
          return false;
        }

        const date = cashflowDate(transaction, input.paidAtDate(transaction));
        return date.startsWith(input.yearMonth);
      })
      .map((transaction) => transaction.amountCents),
  );
}

export function investmentTotals(
  transactions: LedgerTransaction[],
  categories: LedgerCategory[],
  input: { yearMonth: string; throughDate: string; paidAtDate: (transaction: LedgerTransaction) => string | null },
) {
  const investmentIds = new Set(
    categories.filter((category) => category.kind === "INVESTMENT").map((category) => category.id),
  );

  let realized = ZERO_CENTS;
  let pendingPosted = ZERO_CENTS;

  for (const transaction of transactions) {
    if (
      transaction.type !== "EXPENSE" ||
      !transaction.categoryId ||
      !investmentIds.has(transaction.categoryId) ||
      !isLedgerActive(transaction)
    ) {
      continue;
    }

    const date = cashflowDate(transaction, input.paidAtDate(transaction));

    if (isPaidLedger(transaction) && date.startsWith(input.yearMonth)) {
      realized = addCents(realized, transaction.amountCents);
    }

    if (isOpenLedger(transaction) && date.startsWith(input.yearMonth)) {
      pendingPosted = addCents(pendingPosted, transaction.amountCents);
    }
  }

  return { realized, pendingPosted };
}

export function investmentReserve(input: {
  plannedCents: Cents;
  realizedCents: Cents;
  pendingPostedCents: Cents;
}): Cents {
  return maxCents(
    subtractCents(subtractCents(input.plannedCents, input.realizedCents), input.pendingPostedCents),
    ZERO_CENTS,
  );
}

export function availableBalance(input: {
  currentHouseholdCents: Cents;
  pendingIncomeCents: Cents;
  pendingExpenseCents: Cents;
  investmentReserveCents: Cents;
  unpaidCardStatementsCents?: Cents;
}): Cents {
  return subtractCents(
    subtractCents(
      subtractCents(addCents(input.currentHouseholdCents, input.pendingIncomeCents), input.pendingExpenseCents),
      input.investmentReserveCents,
    ),
    input.unpaidCardStatementsCents ?? ZERO_CENTS,
  );
}

export function budgetPercent(usedCents: Cents, limitCents: Cents) {
  if (limitCents <= ZERO_CENTS) {
    return usedCents > ZERO_CENTS ? 100 : 0;
  }

  return Number((usedCents * BigInt(100)) / limitCents);
}

export function budgetAlertLevel(percent: number) {
  if (percent >= 100) {
    return "over" as const;
  }

  if (percent >= 80) {
    return "warning" as const;
  }

  return "ok" as const;
}

export function householdNetWorthFromAccounts(
  accounts: Array<{ id: string; balanceCents: Cents; active: boolean }>,
) {
  return addCents(
    ...accounts.filter((account) => account.active).map((account) => account.balanceCents),
  );
}
