ALTER TABLE "transaction" ADD COLUMN IF NOT EXISTS "budget_impact" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "transaction" DROP CONSTRAINT IF EXISTS "transaction_origin_check";
--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_origin_check" CHECK ("origin" IN ('MANUAL', 'CARD_PAYMENT', 'DEBT_PAYMENT'));
--> statement-breakpoint
ALTER TABLE "transaction" DROP CONSTRAINT IF EXISTS "transaction_transfer_check";
--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_transfer_check" CHECK (
	("type" = 'TRANSFER' AND "category_id" IS NULL AND "destination_account_id" IS NOT NULL AND "destination_account_id" <> "account_id")
	OR
	("type" = 'INCOME' AND "category_id" IS NOT NULL AND "destination_account_id" IS NULL)
	OR
	("type" = 'EXPENSE' AND "origin" = 'CARD_PAYMENT' AND "category_id" IS NULL AND "destination_account_id" IS NULL AND "budget_impact" = false)
	OR
	("type" = 'EXPENSE' AND "origin" <> 'CARD_PAYMENT' AND "category_id" IS NOT NULL AND "destination_account_id" IS NULL)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_card" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"name" text NOT NULL,
	"issuer" text NOT NULL,
	"holder_user_id" text NOT NULL,
	"last_four_digits" text,
	"limit_cents" bigint NOT NULL,
	"closing_day" integer NOT NULL,
	"due_day" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "credit_card_limit_check" CHECK ("limit_cents" > 0),
	CONSTRAINT "credit_card_closing_day_check" CHECK ("closing_day" BETWEEN 1 AND 31),
	CONSTRAINT "credit_card_due_day_check" CHECK ("due_day" BETWEEN 1 AND 31),
	CONSTRAINT "credit_card_last_four_check" CHECK ("last_four_digits" IS NULL OR "last_four_digits" ~ '^[0-9]{4}$')
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_card_statement" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"credit_card_id" text NOT NULL,
	"reference_year" integer NOT NULL,
	"reference_month" integer NOT NULL,
	"closing_date" date NOT NULL,
	"due_date" date NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "credit_card_statement_month_check" CHECK ("reference_month" BETWEEN 1 AND 12),
	CONSTRAINT "credit_card_statement_status_check" CHECK ("status" IN ('OPEN', 'CLOSED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED')),
	CONSTRAINT "credit_card_statement_card_period_unique" UNIQUE("credit_card_id","reference_year","reference_month")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_card_purchase" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"credit_card_id" text NOT NULL,
	"category_id" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"assigned_to_user_id" text,
	"description" text NOT NULL,
	"total_amount_cents" bigint NOT NULL,
	"purchase_date" date NOT NULL,
	"installment_count" integer NOT NULL,
	"status" text NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "credit_card_purchase_amount_check" CHECK ("total_amount_cents" > 0),
	CONSTRAINT "credit_card_purchase_count_check" CHECK ("installment_count" >= 1),
	CONSTRAINT "credit_card_purchase_status_check" CHECK ("status" IN ('ACTIVE', 'CANCELLED'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_card_installment" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"purchase_id" text NOT NULL,
	"credit_card_id" text NOT NULL,
	"statement_id" text NOT NULL,
	"installment_number" integer NOT NULL,
	"installment_count" integer NOT NULL,
	"amount_cents" bigint NOT NULL,
	"reference_year" integer NOT NULL,
	"reference_month" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "credit_card_installment_amount_check" CHECK ("amount_cents" > 0),
	CONSTRAINT "credit_card_installment_number_check" CHECK ("installment_number" >= 1),
	CONSTRAINT "credit_card_installment_purchase_number_unique" UNIQUE("purchase_id","installment_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_card_payment" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"statement_id" text NOT NULL,
	"account_id" text NOT NULL,
	"transaction_id" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"paid_at" timestamp NOT NULL,
	"created_by_user_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "credit_card_payment_amount_check" CHECK ("amount_cents" > 0),
	CONSTRAINT "credit_card_payment_transaction_id_unique" UNIQUE("transaction_id"),
	CONSTRAINT "credit_card_payment_household_idempotency_unique" UNIQUE("household_id","idempotency_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "debt" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"name" text NOT NULL,
	"creditor" text NOT NULL,
	"category_id" text NOT NULL,
	"original_amount_cents" bigint NOT NULL,
	"outstanding_balance_cents" bigint NOT NULL,
	"installment_amount_cents" bigint,
	"total_installments" integer,
	"paid_installments" integer DEFAULT 0 NOT NULL,
	"annual_interest_rate_basis_points" integer,
	"first_due_date" date NOT NULL,
	"status" text NOT NULL,
	"notes" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "debt_original_check" CHECK ("original_amount_cents" > 0),
	CONSTRAINT "debt_outstanding_check" CHECK ("outstanding_balance_cents" >= 0),
	CONSTRAINT "debt_status_check" CHECK ("status" IN ('ACTIVE', 'PAID_OFF', 'NEGOTIATING', 'CANCELLED')),
	CONSTRAINT "debt_rate_check" CHECK ("annual_interest_rate_basis_points" IS NULL OR "annual_interest_rate_basis_points" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "debt_installment" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"debt_id" text NOT NULL,
	"installment_number" integer NOT NULL,
	"due_date" date NOT NULL,
	"amount_cents" bigint NOT NULL,
	"principal_cents" bigint,
	"interest_cents" bigint,
	"status" text NOT NULL,
	"payment_transaction_id" text,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "debt_installment_amount_check" CHECK ("amount_cents" > 0),
	CONSTRAINT "debt_installment_status_check" CHECK ("status" IN ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED')),
	CONSTRAINT "debt_installment_debt_number_unique" UNIQUE("debt_id","installment_number")
);
--> statement-breakpoint
ALTER TABLE "credit_card" ADD CONSTRAINT "credit_card_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_card" ADD CONSTRAINT "credit_card_holder_user_id_fk" FOREIGN KEY ("holder_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_card_statement" ADD CONSTRAINT "credit_card_statement_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_card_statement" ADD CONSTRAINT "credit_card_statement_card_id_fk" FOREIGN KEY ("credit_card_id") REFERENCES "public"."credit_card"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_card_purchase" ADD CONSTRAINT "credit_card_purchase_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_card_purchase" ADD CONSTRAINT "credit_card_purchase_card_id_fk" FOREIGN KEY ("credit_card_id") REFERENCES "public"."credit_card"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_card_purchase" ADD CONSTRAINT "credit_card_purchase_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_card_purchase" ADD CONSTRAINT "credit_card_purchase_created_by_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_card_purchase" ADD CONSTRAINT "credit_card_purchase_assigned_to_user_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_card_installment" ADD CONSTRAINT "credit_card_installment_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_card_installment" ADD CONSTRAINT "credit_card_installment_purchase_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."credit_card_purchase"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_card_installment" ADD CONSTRAINT "credit_card_installment_card_id_fk" FOREIGN KEY ("credit_card_id") REFERENCES "public"."credit_card"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_card_installment" ADD CONSTRAINT "credit_card_installment_statement_id_fk" FOREIGN KEY ("statement_id") REFERENCES "public"."credit_card_statement"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_card_payment" ADD CONSTRAINT "credit_card_payment_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_card_payment" ADD CONSTRAINT "credit_card_payment_statement_id_fk" FOREIGN KEY ("statement_id") REFERENCES "public"."credit_card_statement"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_card_payment" ADD CONSTRAINT "credit_card_payment_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_account"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_card_payment" ADD CONSTRAINT "credit_card_payment_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transaction"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "credit_card_payment" ADD CONSTRAINT "credit_card_payment_created_by_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "debt" ADD CONSTRAINT "debt_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "debt" ADD CONSTRAINT "debt_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "debt" ADD CONSTRAINT "debt_created_by_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "debt_installment" ADD CONSTRAINT "debt_installment_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "debt_installment" ADD CONSTRAINT "debt_installment_debt_id_fk" FOREIGN KEY ("debt_id") REFERENCES "public"."debt"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "debt_installment" ADD CONSTRAINT "debt_installment_payment_transaction_id_fk" FOREIGN KEY ("payment_transaction_id") REFERENCES "public"."transaction"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_card_household_id_idx" ON "credit_card" USING btree ("household_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_card_holder_user_id_idx" ON "credit_card" USING btree ("holder_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_card_statement_household_id_idx" ON "credit_card_statement" USING btree ("household_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_card_statement_card_id_idx" ON "credit_card_statement" USING btree ("credit_card_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_card_purchase_household_id_idx" ON "credit_card_purchase" USING btree ("household_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_card_purchase_card_id_idx" ON "credit_card_purchase" USING btree ("credit_card_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_card_purchase_category_id_idx" ON "credit_card_purchase" USING btree ("category_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_card_installment_household_id_idx" ON "credit_card_installment" USING btree ("household_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_card_installment_statement_id_idx" ON "credit_card_installment" USING btree ("statement_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_card_installment_card_id_idx" ON "credit_card_installment" USING btree ("credit_card_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_card_payment_statement_id_idx" ON "credit_card_payment" USING btree ("statement_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_card_payment_household_id_idx" ON "credit_card_payment" USING btree ("household_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "debt_household_id_idx" ON "debt" USING btree ("household_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "debt_category_id_idx" ON "debt" USING btree ("category_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "debt_installment_household_id_idx" ON "debt_installment" USING btree ("household_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "debt_installment_debt_id_idx" ON "debt_installment" USING btree ("debt_id");
