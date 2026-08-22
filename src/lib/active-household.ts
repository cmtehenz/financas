import { cookies } from "next/headers";

import { isUuid } from "@/lib/ids";

export const ACTIVE_HOUSEHOLD_COOKIE = "ff_active_household";

export async function readActiveHouseholdCookie() {
  const store = await cookies();
  const value = store.get(ACTIVE_HOUSEHOLD_COOKIE)?.value;

  if (!value || !isUuid(value)) {
    return null;
  }

  return value;
}

export async function writeActiveHouseholdCookie(householdId: string) {
  if (!isUuid(householdId)) {
    return;
  }

  const store = await cookies();
  store.set(ACTIVE_HOUSEHOLD_COOKIE, householdId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
