import { describe, expect, it } from "vitest";

import { ForbiddenError, assertHouseholdAccess, assertHouseholdOwner } from "@/lib/access";

const owner = { householdId: "house-a", userId: "user-1", role: "OWNER" as const };
const member = { householdId: "house-a", userId: "user-2", role: "MEMBER" as const };

describe("household access helpers", () => {
  it("accepts a membership", () => {
    expect(() => assertHouseholdAccess(owner)).not.toThrow();
  });

  it("rejects a missing membership from a tampered cookie or URL", () => {
    expect(() => assertHouseholdAccess(null)).toThrow(ForbiddenError);
    expect(() => assertHouseholdAccess(undefined)).toThrow(/FORBIDDEN/);
  });

  it("allows an owner to manage the household", () => {
    expect(() => assertHouseholdOwner(owner)).not.toThrow();
  });

  it("does not allow a member to act as owner", () => {
    expect(() => assertHouseholdOwner(member)).toThrow(ForbiddenError);
    expect(() => assertHouseholdOwner(member)).toThrow(/OWNER_REQUIRED/);
  });
});
