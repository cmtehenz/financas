import { sql } from "drizzle-orm";
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
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { categories, financialAccounts, households } from "./household";

export const recurringRules = pgTable(
  "recurring_rule",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => financialAccounts.id),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id),
    assignedToUserId: text("assigned_to_user_id").references(() => user.id),
    description: text("description").notNull(),
    type: text("type").notNull(),
    amountCents: bigint("amount_cents", { mode: "bigint" }).notNull(),
    frequency: text("frequency").notNull().default("MONTHLY"),
    dueDay: integer("due_day").notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }),
    nextOccurrenceDate: date("next_occurrence_date", { mode: "string" }).notNull(),
    defaultStatus: text("default_status").notNull(),
    active: boolean("active").notNull().default(true),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("recurring_rule_household_id_idx").on(table.householdId),
    index("recurring_rule_account_id_idx").on(table.accountId),
  ],
);

export const transactions = pgTable(
  "transaction",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => financialAccounts.id),
    destinationAccountId: text("destination_account_id").references(() => financialAccounts.id),
    categoryId: text("category_id").references(() => categories.id),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id),
    assignedToUserId: text("assigned_to_user_id").references(() => user.id),
    description: text("description").notNull(),
    normalizedDescription: text("normalized_description"),
    type: text("type").notNull(),
    amountCents: bigint("amount_cents", { mode: "bigint" }).notNull(),
    status: text("status").notNull(),
    visibility: text("visibility").notNull().default("HOUSEHOLD"),
    origin: text("origin").notNull().default("MANUAL"),
    transactionDate: date("transaction_date", { mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }),
    paidAt: timestamp("paid_at"),
    notes: text("notes"),
    recurringRuleId: text("recurring_rule_id").references(() => recurringRules.id),
    recurrenceOccurrenceKey: text("recurrence_occurrence_key"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("transaction_household_date_idx").on(table.householdId, table.transactionDate),
    index("transaction_household_status_idx").on(table.householdId, table.status),
    index("transaction_account_id_idx").on(table.accountId),
    index("transaction_destination_account_id_idx").on(table.destinationAccountId),
    index("transaction_category_id_idx").on(table.categoryId),
    index("transaction_recurring_rule_id_idx").on(table.recurringRuleId),
    uniqueIndex("transaction_recurrence_occurrence_unique")
      .on(table.householdId, table.recurringRuleId, table.recurrenceOccurrenceKey)
      .where(sql`${table.recurringRuleId} is not null and ${table.recurrenceOccurrenceKey} is not null`),
  ],
);

export const monthlyBudgets = pgTable(
  "monthly_budget",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    expectedIncomeCents: bigint("expected_income_cents", { mode: "bigint" }).notNull(),
    plannedInvestmentCents: bigint("planned_investment_cents", { mode: "bigint" }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("monthly_budget_household_year_month_unique").on(table.householdId, table.year, table.month),
    index("monthly_budget_household_id_idx").on(table.householdId),
  ],
);

export const categoryBudgets = pgTable(
  "category_budget",
  {
    id: text("id").primaryKey(),
    monthlyBudgetId: text("monthly_budget_id")
      .notNull()
      .references(() => monthlyBudgets.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id),
    limitCents: bigint("limit_cents", { mode: "bigint" }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("category_budget_monthly_category_unique").on(table.monthlyBudgetId, table.categoryId),
    index("category_budget_category_id_idx").on(table.categoryId),
  ],
);

export const auditEvents = pgTable(
  "audit_event",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => user.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    changedFields: text("changed_fields"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("audit_event_household_id_idx").on(table.householdId),
    index("audit_event_entity_idx").on(table.entityType, table.entityId),
  ],
);
