import { createNeonAuth } from "@neondatabase/auth/next/server";

/**
 * Managed Neon Auth instance. The app still uses the Phase 1 Better Auth
 * in `src/lib/auth.ts` for login, cadastro and sessions.
 */
export const neonAuth = process.env.NEON_AUTH_BASE_URL
  ? createNeonAuth({
      baseUrl: process.env.NEON_AUTH_BASE_URL,
      cookies: {
        secret: process.env.NEON_AUTH_COOKIE_SECRET ?? process.env.BETTER_AUTH_SECRET ?? "",
      },
    })
  : null;
