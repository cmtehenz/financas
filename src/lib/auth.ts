import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";

import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { getAppUrl, parseServerEnv } from "@/lib/env";
import { getTrustedOrigins } from "@/lib/trusted-origins";

const BUILD_PLACEHOLDER_SECRET = "build-placeholder-secret-min-32-chars!!";

type AuthInstance = ReturnType<typeof createAuth>;

let authInstance: AuthInstance | undefined;

function createAuth() {
  const env = parseServerEnv();
  const isBuild = process.env.NEXT_PHASE === "phase-production-build";
  const secret = env.BETTER_AUTH_SECRET ?? (isBuild ? BUILD_PLACEHOLDER_SECRET : undefined);

  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is not configured");
  }

  return betterAuth({
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema,
    }),
    secret,
    baseURL: getAppUrl(env),
    trustedOrigins: getTrustedOrigins(getAppUrl(env)),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      sendResetPassword: async () => {
        // Email delivery stays disabled until a mailer is configured.
        // Do not log tokens, reset URLs, or user identifiers.
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5,
      },
    },
    // In-memory Better Auth limiter. It is not shared across Vercel instances.
    rateLimit: {
      enabled: true,
      window: 60,
      max: 10,
    },
    advanced: {
      useSecureCookies: process.env.NODE_ENV === "production" || process.env.VERCEL === "1",
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production" || process.env.VERCEL === "1",
        path: "/",
      },
    },
    plugins: [nextCookies()],
  });
}

export function getAuth() {
  if (!authInstance) {
    authInstance = createAuth();
  }

  return authInstance;
}

export type Session = AuthInstance["$Infer"]["Session"];
