ALTER TABLE "account" ADD COLUMN "issuer" text;
UPDATE "account" SET "issuer" = 'credential' WHERE "issuer" IS NULL AND "provider_id" = 'credential';
UPDATE "account" SET "issuer" = "provider_id" WHERE "issuer" IS NULL;
ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "account_issuer_account_id_idx" ON "account" USING btree ("issuer", "account_id");
