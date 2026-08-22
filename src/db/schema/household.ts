import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const households = pgTable("household", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  currency: text("currency").notNull().default("BRL"),
  timezone: text("timezone").notNull().default("America/Sao_Paulo"),
  onboardingCompletedAt: timestamp("onboarding_completed_at"),
  createdByUserId: text("created_by_user_id")
    .notNull()
    .references(() => user.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const householdMembers = pgTable(
  "household_member",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("household_member_household_id_user_id_unique").on(table.householdId, table.userId),
    index("household_member_user_id_idx").on(table.userId),
    index("household_member_household_id_idx").on(table.householdId),
  ],
);

export const householdInvitations = pgTable(
  "household_invitation",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    acceptedAt: timestamp("accepted_at"),
    revokedAt: timestamp("revoked_at"),
    invitedByUserId: text("invited_by_user_id")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("household_invitation_household_id_idx").on(table.householdId),
    index("household_invitation_email_idx").on(table.email),
    uniqueIndex("household_invitation_pending_email_idx")
      .on(table.householdId, table.email)
      .where(sql`${table.acceptedAt} is null and ${table.revokedAt} is null`),
  ],
);

export const financialAccounts = pgTable(
  "financial_account",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    institutionName: text("institution_name"),
    type: text("type").notNull(),
    openingBalanceCents: bigint("opening_balance_cents", { mode: "bigint" }).notNull(),
    openingBalanceDate: date("opening_balance_date", { mode: "string" }).notNull(),
    currency: text("currency").notNull().default("BRL"),
    connectionType: text("connection_type").notNull().default("MANUAL"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [index("financial_account_household_id_idx").on(table.householdId)],
);

export const categories = pgTable(
  "category",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    type: text("type").notNull(),
    kind: text("kind").notNull(),
    color: text("color").notNull(),
    icon: text("icon").notNull(),
    active: boolean("active").notNull().default(true),
    systemDefault: boolean("system_default").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("category_household_type_slug_unique").on(table.householdId, table.type, table.slug),
    index("category_household_id_idx").on(table.householdId),
  ],
);
