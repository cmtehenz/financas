import { z } from "zod";

const optionalNonEmpty = z
  .string()
  .trim()
  .min(1)
  .optional()
  .or(z.literal("").transform(() => undefined));

export const serverEnvSchema = z.object({
  DATABASE_URL: optionalNonEmpty,
  BETTER_AUTH_SECRET: z
    .string()
    .trim()
    .min(32, "BETTER_AUTH_SECRET must have at least 32 characters")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  BETTER_AUTH_URL: z
    .string()
    .trim()
    .url()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  NEXT_PUBLIC_APP_URL: z
    .string()
    .trim()
    .url()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  OPENAI_API_KEY: optionalNonEmpty,
  OPENAI_MODEL: optionalNonEmpty,
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(
  env: Record<string, string | undefined> = process.env,
): ServerEnv {
  return serverEnvSchema.parse({
    DATABASE_URL: env.DATABASE_URL,
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: env.BETTER_AUTH_URL,
    NEXT_PUBLIC_APP_URL: env.NEXT_PUBLIC_APP_URL,
    OPENAI_API_KEY: env.OPENAI_API_KEY,
    OPENAI_MODEL: env.OPENAI_MODEL,
    NODE_ENV: env.NODE_ENV,
  });
}

export function getMissingRequiredEnv(env: ServerEnv = parseServerEnv()) {
  const missing: string[] = [];

  if (!env.DATABASE_URL) {
    missing.push("DATABASE_URL");
  }

  if (!env.BETTER_AUTH_SECRET) {
    missing.push("BETTER_AUTH_SECRET");
  }

  if (!env.BETTER_AUTH_URL && !env.NEXT_PUBLIC_APP_URL) {
    missing.push("BETTER_AUTH_URL");
  }

  return missing;
}

export function requireServerEnv(env: Record<string, string | undefined> = process.env) {
  const parsed = parseServerEnv(env);
  const missing = getMissingRequiredEnv(parsed);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  return {
    ...parsed,
    DATABASE_URL: parsed.DATABASE_URL as string,
    BETTER_AUTH_SECRET: parsed.BETTER_AUTH_SECRET as string,
    BETTER_AUTH_URL: (parsed.BETTER_AUTH_URL ?? parsed.NEXT_PUBLIC_APP_URL) as string,
  };
}

export function isOpenAiConfigured(env: ServerEnv = parseServerEnv()) {
  return Boolean(env.OPENAI_API_KEY);
}

export function getAppUrl(env: ServerEnv = parseServerEnv()) {
  return env.BETTER_AUTH_URL ?? env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
