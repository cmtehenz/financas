import { getMissingRequiredEnv, isOpenAiConfigured, parseServerEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const env = parseServerEnv();
  const missing = getMissingRequiredEnv(env);

  return Response.json({
    status: missing.length === 0 ? "ok" : "degraded",
    checks: {
      database: env.DATABASE_URL ? "configured" : "missing",
      auth: env.BETTER_AUTH_SECRET ? "configured" : "missing",
      ai: isOpenAiConfigured(env) ? "configured" : "disabled",
    },
  });
}
