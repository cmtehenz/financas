import { applyTestDatabaseEnv } from "@/lib/test-database";

if (process.env.TEST_DATABASE_URL) {
  applyTestDatabaseEnv();
}
