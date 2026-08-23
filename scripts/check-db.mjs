import { existsSync } from "node:fs";
import path from "node:path";

const requiredFiles = [
  "src/db/schema/auth.ts",
  "src/db/schema/household.ts",
  "src/db/schema/index.ts",
  "drizzle/0000_better_auth.sql",
  "drizzle/0001_auth_account_issuer.sql",
  "drizzle/0002_household_onboarding.sql",
  "drizzle/0003_transactions_budget.sql",
  "drizzle/0004_cards_debts.sql",
  "drizzle/0005_planning_amount_copy.sql",
  "src/db/schema/ledger.ts",
  "src/db/schema/cards-debts.ts",
  "drizzle/meta/_journal.json",
];

const missing = requiredFiles.filter((file) => !existsSync(path.resolve(file)));

if (missing.length > 0) {
  console.error(`Database check failed. Missing files: ${missing.join(", ")}`);
  process.exit(1);
}

console.info("Database schema and versioned migrations are present.");
console.info("Run `pnpm db:migrate` against Neon when DATABASE_URL is configured.");
console.info("Do not use drizzle-kit push in production.");
