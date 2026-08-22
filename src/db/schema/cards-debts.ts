import {
  bigint,
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { categories, financialAccounts, households } from "./household";
import { transactions } from "./ledger";

export const creditCards = pgTable(
  "credit_card",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    issuer: text("issuer").notNull(),
    holderUserId: text("holder_user_id")
      .notNull()
      .references(() => user.id),
    lastFourDigits: text("last_four_digits"),
    limitCents: bigint("limit_cents", { mode: "bigint" }).notNull(),
    closingDay: integer("closing_day").notNull(),
    dueDay: integer("due_day").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("credit_card_household_id_idx").on(table.householdId),
    index("credit_card_holder_user_id_idx").on(table.holderUserId),
  ],
);

export const creditCardStatements = pgTable(
  "credit_card_statement",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    creditCardId: text("credit_card_id")
      .notNull()
      .references(() => creditCards.id),
    referenceYear: integer("reference_year").notNull(),
    referenceMonth: integer("reference_month").notNull(),
    closingDate: date("closing_date", { mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    status: text("status").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("credit_card_statement_card_period_unique").on(
      table.creditCardId,
      table.referenceYear,
      table.referenceMonth,
    ),
    index("credit_card_statement_household_id_idx").on(table.householdId),
    index("credit_card_statement_card_id_idx").on(table.creditCardId),
  ],
);

export const creditCardPurchases = pgTable(
  "credit_card_purchase",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    creditCardId: text("credit_card_id")
      .notNull()
      .references(() => creditCards.id),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id),
    assignedToUserId: text("assigned_to_user_id").references(() => user.id),
    description: text("description").notNull(),
    totalAmountCents: bigint("total_amount_cents", { mode: "bigint" }).notNull(),
    purchaseDate: date("purchase_date", { mode: "string" }).notNull(),
    installmentCount: integer("installment_count").notNull(),
    status: text("status").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("credit_card_purchase_household_id_idx").on(table.householdId),
    index("credit_card_purchase_card_id_idx").on(table.creditCardId),
    index("credit_card_purchase_category_id_idx").on(table.categoryId),
  ],
);

export const creditCardInstallments = pgTable(
  "credit_card_installment",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    purchaseId: text("purchase_id")
      .notNull()
      .references(() => creditCardPurchases.id),
    creditCardId: text("credit_card_id")
      .notNull()
      .references(() => creditCards.id),
    statementId: text("statement_id")
      .notNull()
      .references(() => creditCardStatements.id),
    installmentNumber: integer("installment_number").notNull(),
    installmentCount: integer("installment_count").notNull(),
    amountCents: bigint("amount_cents", { mode: "bigint" }).notNull(),
    referenceYear: integer("reference_year").notNull(),
    referenceMonth: integer("reference_month").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("credit_card_installment_purchase_number_unique").on(table.purchaseId, table.installmentNumber),
    index("credit_card_installment_household_id_idx").on(table.householdId),
    index("credit_card_installment_statement_id_idx").on(table.statementId),
    index("credit_card_installment_card_id_idx").on(table.creditCardId),
  ],
);

export const creditCardPayments = pgTable(
  "credit_card_payment",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    statementId: text("statement_id")
      .notNull()
      .references(() => creditCardStatements.id),
    accountId: text("account_id")
      .notNull()
      .references(() => financialAccounts.id),
    transactionId: text("transaction_id")
      .notNull()
      .unique()
      .references(() => transactions.id),
    amountCents: bigint("amount_cents", { mode: "bigint" }).notNull(),
    paidAt: timestamp("paid_at").notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("credit_card_payment_household_idempotency_unique").on(table.householdId, table.idempotencyKey),
    index("credit_card_payment_statement_id_idx").on(table.statementId),
    index("credit_card_payment_household_id_idx").on(table.householdId),
  ],
);

export const debts = pgTable(
  "debt",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    creditor: text("creditor").notNull(),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id),
    originalAmountCents: bigint("original_amount_cents", { mode: "bigint" }).notNull(),
    outstandingBalanceCents: bigint("outstanding_balance_cents", { mode: "bigint" }).notNull(),
    installmentAmountCents: bigint("installment_amount_cents", { mode: "bigint" }),
    totalInstallments: integer("total_installments"),
    paidInstallments: integer("paid_installments").notNull().default(0),
    annualInterestRateBasisPoints: integer("annual_interest_rate_basis_points"),
    firstDueDate: date("first_due_date", { mode: "string" }).notNull(),
    status: text("status").notNull(),
    notes: text("notes"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("debt_household_id_idx").on(table.householdId),
    index("debt_category_id_idx").on(table.categoryId),
  ],
);

export const debtInstallments = pgTable(
  "debt_installment",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    debtId: text("debt_id")
      .notNull()
      .references(() => debts.id),
    installmentNumber: integer("installment_number").notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    amountCents: bigint("amount_cents", { mode: "bigint" }).notNull(),
    principalCents: bigint("principal_cents", { mode: "bigint" }),
    interestCents: bigint("interest_cents", { mode: "bigint" }),
    status: text("status").notNull(),
    paymentTransactionId: text("payment_transaction_id").references(() => transactions.id),
    paidAt: timestamp("paid_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("debt_installment_debt_number_unique").on(table.debtId, table.installmentNumber),
    index("debt_installment_household_id_idx").on(table.householdId),
    index("debt_installment_debt_id_idx").on(table.debtId),
  ],
);
