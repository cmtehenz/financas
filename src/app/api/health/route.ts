import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import { isOpenAiConfigured, parseServerEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

async function databaseStatus() {
  try {
    if (!parseServerEnv().DATABASE_URL) {
      return "unavailable" as const;
    }

    await getDb().execute(sql`select 1`);
    return "available" as const;
  } catch {
    return "unavailable" as const;
  }
}

export async function GET() {
  const database = await databaseStatus();

  return Response.json({
    status: database === "available" ? "ok" : "degraded",
    app: "financeiro-familiar",
    database,
    ai: isOpenAiConfigured() ? "configured" : "disabled",
    timestamp: new Date().toISOString(),
  });
}
