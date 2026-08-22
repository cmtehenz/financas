import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

import * as schema from "./schema";

neonConfig.webSocketConstructor = ws;

type Database = ReturnType<typeof createDb>;

let db: Database | undefined;
let pool: Pool | undefined;

function createDb() {
  const isBuild = process.env.NEXT_PHASE === "phase-production-build";
  const databaseUrl =
    process.env.DATABASE_URL ??
    (isBuild ? "postgresql://build:build@127.0.0.1/build" : undefined);

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  pool = new Pool({ connectionString: databaseUrl });
  return drizzle({ client: pool, schema });
}

export function getDb() {
  if (!db) {
    db = createDb();
  }

  return db;
}

export async function closeDb() {
  await pool?.end();
  pool = undefined;
  db = undefined;
}

export type AppDatabase = Database;
