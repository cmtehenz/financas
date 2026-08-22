import { describe, expect, it } from "vitest";

import { getPendingOnboardingPath } from "@/lib/onboarding-state";

describe("getPendingOnboardingPath", () => {
  it("sends a user without a household to the first step", () => {
    expect(getPendingOnboardingPath(null)).toBe("/onboarding");
  });

  it("sends a household without accounts to the accounts step", () => {
    expect(
      getPendingOnboardingPath({
        id: "h1",
        onboardingCompletedAt: null,
        accountCount: 0,
      }),
    ).toBe("/onboarding/contas");
  });

  it("sends a completed household to the dashboard", () => {
    expect(
      getPendingOnboardingPath({
        id: "h1",
        onboardingCompletedAt: new Date(),
        accountCount: 2,
      }),
    ).toBe("/dashboard");
  });
});
