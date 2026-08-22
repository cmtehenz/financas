import { redirect } from "next/navigation";

import { ForbiddenError } from "@/lib/access";
import { readActiveHouseholdCookie } from "@/lib/active-household";
import { getPendingOnboardingPath, type OnboardingHousehold } from "@/lib/onboarding-state";
import { requireSession } from "@/lib/require-session";
import {
  countActiveAccounts,
  findHouseholdMembership,
  getUserHouseholds,
  type HouseholdMembershipRecord,
} from "@/services/households";

export { requireSession } from "@/lib/require-session";

export async function getActiveHousehold(userId: string) {
  const households = await getUserHouseholds(userId);
  if (households.length === 0) {
    return null;
  }

  const requestedId = await readActiveHouseholdCookie();
  const matched = requestedId
    ? households.find((item) => item.household.id === requestedId)
    : undefined;

  return matched ?? households[0] ?? null;
}

export async function toOnboardingHousehold(
  record: HouseholdMembershipRecord | null,
): Promise<OnboardingHousehold | null> {
  if (!record) {
    return null;
  }

  return {
    id: record.household.id,
    onboardingCompletedAt: record.household.onboardingCompletedAt,
    accountCount: await countActiveAccounts(record.household.id),
  };
}

export async function requireHouseholdMembership(householdId?: string) {
  const session = await requireSession();
  const requestedId = householdId ?? (await readActiveHouseholdCookie());

  if (requestedId) {
    const membership = await findHouseholdMembership(session.user.id, requestedId);
    if (membership) {
      return { session, ...membership };
    }

    if (householdId) {
      throw new ForbiddenError();
    }
  }

  const fallback = await getActiveHousehold(session.user.id);
  if (!fallback) {
    throw new ForbiddenError();
  }

  return { session, ...fallback };
}

export async function requireHouseholdOwner(householdId?: string) {
  const context = await requireHouseholdMembership(householdId);

  if (context.membership.role !== "OWNER") {
    throw new ForbiddenError("OWNER_REQUIRED");
  }

  return context;
}

export async function requireCompletedHousehold() {
  const session = await requireSession();
  const active = await getActiveHousehold(session.user.id);
  const onboarding = await toOnboardingHousehold(active);
  const pending = getPendingOnboardingPath(onboarding);

  if (pending !== "/dashboard" || !active) {
    redirect(pending);
  }

  return { session, ...active };
}

export async function requireOnboardingHousehold() {
  const session = await requireSession();
  const active = await getActiveHousehold(session.user.id);
  return { session, active, onboarding: await toOnboardingHousehold(active) };
}
