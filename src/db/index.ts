import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

type Database = ReturnType<typeof createDb>;

let db: Database | undefined;

function createDb() {
  const isBuild = process.env.NEXT_PHASE === "phase-production-build";
  const databaseUrl =
    process.env.DATABASE_URL ??
    (isBuild ? "postgresql://build:build@127.0.0.1/build" : undefined);

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  return drizzle({ client: neon(databaseUrl), schema });
}

export function getDb() {
  if (!db) {
    db = createDb();
  }

  return db;
}

export type AppDatabase = Database;
