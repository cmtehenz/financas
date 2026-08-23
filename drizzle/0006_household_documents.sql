CREATE TABLE IF NOT EXISTS "household_document" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"kind" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"content" bytea NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "household_document_kind_check" CHECK ("kind" IN ('BOLETO', 'RECEIPT', 'INVOICE', 'OTHER')),
	CONSTRAINT "household_document_subject_check" CHECK ("subject_type" IN ('TRANSACTION', 'CARD_STATEMENT', 'DEBT_INSTALLMENT')),
	CONSTRAINT "household_document_size_check" CHECK ("byte_size" > 0 AND "byte_size" <= 4194304)
);
--> statement-breakpoint
ALTER TABLE "household_document" ADD CONSTRAINT "household_document_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "household_document" ADD CONSTRAINT "household_document_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "household_document_subject_idx" ON "household_document" USING btree ("household_id","subject_type","subject_id");
