import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuth, type Session } from "@/lib/auth";
import { getSafeInternalPath } from "@/lib/safe-redirect";

export { assertSession, UnauthorizedError } from "@/lib/session";

export async function getOptionalSession(): Promise<Session | null> {
  try {
    return await getAuth().api.getSession({
      headers: await headers(),
    });
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<Session> {
  const session = await getOptionalSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}

export async function redirectIfAuthenticated(next?: string | null) {
  const session = await getOptionalSession();
  if (session) {
    redirect(getSafeInternalPath(next));
  }
}
