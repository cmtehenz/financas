CREATE TABLE IF NOT EXISTS "household" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"onboarding_completed_at" timestamp,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "household_currency_check" CHECK ("currency" = 'BRL')
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "household_member" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "household_member_role_check" CHECK ("role" IN ('OWNER', 'MEMBER')),
	CONSTRAINT "household_member_household_id_user_id_unique" UNIQUE("household_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "household_invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"revoked_at" timestamp,
	"invited_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "household_invitation_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "financial_account" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"name" text NOT NULL,
	"institution_name" text,
	"type" text NOT NULL,
	"opening_balance_cents" bigint NOT NULL,
	"opening_balance_date" date NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"connection_type" text DEFAULT 'MANUAL' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "financial_account_type_check" CHECK ("type" IN ('CHECKING', 'SAVINGS', 'CASH', 'INVESTMENT', 'OTHER')),
	CONSTRAINT "financial_account_connection_type_check" CHECK ("connection_type" = 'MANUAL'),
	CONSTRAINT "financial_account_currency_check" CHECK ("currency" = 'BRL')
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "category" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"type" text NOT NULL,
	"kind" text NOT NULL,
	"color" text NOT NULL,
	"icon" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"system_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "category_type_check" CHECK ("type" IN ('INCOME', 'EXPENSE')),
	CONSTRAINT "category_kind_check" CHECK ("kind" IN ('FIXED', 'VARIABLE', 'DEBT', 'INVESTMENT', 'OTHER')),
	CONSTRAINT "category_household_type_slug_unique" UNIQUE("household_id","type","slug")
);
--> statement-breakpoint
ALTER TABLE "household" ADD CONSTRAINT "household_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "household_member" ADD CONSTRAINT "household_member_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "household_member" ADD CONSTRAINT "household_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "household_invitation" ADD CONSTRAINT "household_invitation_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "household_invitation" ADD CONSTRAINT "household_invitation_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "financial_account" ADD CONSTRAINT "financial_account_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "household_member_user_id_idx" ON "household_member" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "household_member_household_id_idx" ON "household_member" USING btree ("household_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "household_invitation_household_id_idx" ON "household_invitation" USING btree ("household_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "household_invitation_email_idx" ON "household_invitation" USING btree ("email");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "household_invitation_pending_email_idx" ON "household_invitation" ("household_id","email") WHERE "accepted_at" IS NULL AND "revoked_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_account_household_id_idx" ON "financial_account" USING btree ("household_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "category_household_id_idx" ON "category" USING btree ("household_id");
