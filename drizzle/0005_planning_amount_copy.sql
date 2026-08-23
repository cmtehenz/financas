-- amount_cents is never null.
-- 0 means "A definir" for PLANNED/PENDING reminders whose value has not arrived yet.
-- Zero never enters planning totals and cannot be marked PAID.
-- PAID continues to require a positive amount.
ALTER TABLE "transaction" DROP CONSTRAINT "transaction_amount_check";
--> statement-breakpoint
ALTER TABLE "transaction" ADD COLUMN "planning_copy_key" text;
--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_amount_check" CHECK ("amount_cents" >= 0 AND ("status" <> 'PAID' OR "amount_cents" > 0));
--> statement-breakpoint
CREATE UNIQUE INDEX "transaction_planning_copy_unique" ON "transaction" USING btree ("household_id","planning_copy_key") WHERE "planning_copy_key" is not null;
