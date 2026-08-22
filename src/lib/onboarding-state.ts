export type OnboardingHousehold = {
  id: string;
  onboardingCompletedAt: Date | null;
  accountCount: number;
};

export type OnboardingPath =
  | "/onboarding"
  | "/onboarding/contas"
  | "/onboarding/convite"
  | "/onboarding/revisao"
  | "/dashboard";

export function getPendingOnboardingPath(household: OnboardingHousehold | null): OnboardingPath {
  if (!household) {
    return "/onboarding";
  }

  if (household.onboardingCompletedAt) {
    return "/dashboard";
  }

  if (household.accountCount < 1) {
    return "/onboarding/contas";
  }

  return "/onboarding/convite";
}

export function isOnboardingPath(pathname: string) {
  return pathname === "/onboarding" || pathname.startsWith("/onboarding/");
}
