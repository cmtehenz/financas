CREATE TABLE IF NOT EXISTS "recurring_rule" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"account_id" text NOT NULL,
	"category_id" text NOT NULL,
	"assigned_to_user_id" text,
	"description" text NOT NULL,
	"type" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"frequency" text DEFAULT 'MONTHLY' NOT NULL,
	"due_day" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"next_occurrence_date" date NOT NULL,
	"default_status" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_rule_type_check" CHECK ("type" IN ('INCOME', 'EXPENSE')),
	CONSTRAINT "recurring_rule_frequency_check" CHECK ("frequency" = 'MONTHLY'),
	CONSTRAINT "recurring_rule_default_status_check" CHECK ("default_status" IN ('PLANNED', 'PENDING')),
	CONSTRAINT "recurring_rule_amount_check" CHECK ("amount_cents" > 0),
	CONSTRAINT "recurring_rule_due_day_check" CHECK ("due_day" BETWEEN 1 AND 31)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transaction" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"account_id" text NOT NULL,
	"destination_account_id" text,
	"category_id" text,
	"created_by_user_id" text NOT NULL,
	"assigned_to_user_id" text,
	"description" text NOT NULL,
	"normalized_description" text,
	"type" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"status" text NOT NULL,
	"visibility" text DEFAULT 'HOUSEHOLD' NOT NULL,
	"origin" text DEFAULT 'MANUAL' NOT NULL,
	"transaction_date" date NOT NULL,
	"due_date" date,
	"paid_at" timestamp,
	"notes" text,
	"recurring_rule_id" text,
	"recurrence_occurrence_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "transaction_type_check" CHECK ("type" IN ('INCOME', 'EXPENSE', 'TRANSFER')),
	CONSTRAINT "transaction_status_check" CHECK ("status" IN ('PLANNED', 'PENDING', 'PAID', 'CANCELLED')),
	CONSTRAINT "transaction_visibility_check" CHECK ("visibility" = 'HOUSEHOLD'),
	CONSTRAINT "transaction_origin_check" CHECK ("origin" = 'MANUAL'),
	CONSTRAINT "transaction_amount_check" CHECK ("amount_cents" > 0),
	CONSTRAINT "transaction_paid_at_check" CHECK ("status" <> 'PAID' OR "paid_at" IS NOT NULL),
	CONSTRAINT "transaction_transfer_check" CHECK (
		("type" <> 'TRANSFER' AND "category_id" IS NOT NULL AND "destination_account_id" IS NULL)
		OR
		("type" = 'TRANSFER' AND "category_id" IS NULL AND "destination_account_id" IS NOT NULL AND "destination_account_id" <> "account_id")
	)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "monthly_budget" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"expected_income_cents" bigint NOT NULL,
	"planned_investment_cents" bigint NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "monthly_budget_month_check" CHECK ("month" BETWEEN 1 AND 12),
	CONSTRAINT "monthly_budget_income_check" CHECK ("expected_income_cents" >= 0),
	CONSTRAINT "monthly_budget_investment_check" CHECK ("planned_investment_cents" >= 0),
	CONSTRAINT "monthly_budget_household_year_month_unique" UNIQUE("household_id","year","month")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "category_budget" (
	"id" text PRIMARY KEY NOT NULL,
	"monthly_budget_id" text NOT NULL,
	"category_id" text NOT NULL,
	"limit_cents" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "category_budget_limit_check" CHECK ("limit_cents" >= 0),
	CONSTRAINT "category_budget_monthly_category_unique" UNIQUE("monthly_budget_id","category_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_event" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"changed_fields" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recurring_rule" ADD CONSTRAINT "recurring_rule_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recurring_rule" ADD CONSTRAINT "recurring_rule_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_account"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recurring_rule" ADD CONSTRAINT "recurring_rule_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recurring_rule" ADD CONSTRAINT "recurring_rule_assigned_to_user_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recurring_rule" ADD CONSTRAINT "recurring_rule_created_by_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_account"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_destination_account_id_fk" FOREIGN KEY ("destination_account_id") REFERENCES "public"."financial_account"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_created_by_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_assigned_to_user_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_recurring_rule_id_fk" FOREIGN KEY ("recurring_rule_id") REFERENCES "public"."recurring_rule"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "monthly_budget" ADD CONSTRAINT "monthly_budget_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "category_budget" ADD CONSTRAINT "category_budget_monthly_budget_id_fk" FOREIGN KEY ("monthly_budget_id") REFERENCES "public"."monthly_budget"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "category_budget" ADD CONSTRAINT "category_budget_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_actor_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recurring_rule_household_id_idx" ON "recurring_rule" USING btree ("household_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recurring_rule_account_id_idx" ON "recurring_rule" USING btree ("account_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transaction_household_date_idx" ON "transaction" USING btree ("household_id","transaction_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transaction_household_status_idx" ON "transaction" USING btree ("household_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transaction_account_id_idx" ON "transaction" USING btree ("account_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transaction_destination_account_id_idx" ON "transaction" USING btree ("destination_account_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transaction_category_id_idx" ON "transaction" USING btree ("category_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transaction_recurring_rule_id_idx" ON "transaction" USING btree ("recurring_rule_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "transaction_recurrence_occurrence_unique" ON "transaction" ("household_id","recurring_rule_id","recurrence_occurrence_key") WHERE "recurring_rule_id" IS NOT NULL AND "recurrence_occurrence_key" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "monthly_budget_household_id_idx" ON "monthly_budget" USING btree ("household_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "category_budget_category_id_idx" ON "category_budget" USING btree ("category_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_event_household_id_idx" ON "audit_event" USING btree ("household_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_event_entity_idx" ON "audit_event" USING btree ("entity_type","entity_id");
