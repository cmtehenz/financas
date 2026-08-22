export class ForbiddenError extends Error {
  constructor(message = "FORBIDDEN") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export type HouseholdRole = "OWNER" | "MEMBER";

export type HouseholdAccess = {
  householdId: string;
  userId: string;
  role: HouseholdRole;
};

export function isHouseholdRole(value: string): value is HouseholdRole {
  return value === "OWNER" || value === "MEMBER";
}

export function assertHouseholdAccess(
  membership: HouseholdAccess | null | undefined,
): asserts membership is HouseholdAccess {
  if (!membership) {
    throw new ForbiddenError();
  }
}

export function assertHouseholdOwner(
  membership: HouseholdAccess | null | undefined,
): asserts membership is HouseholdAccess {
  assertHouseholdAccess(membership);

  if (membership.role !== "OWNER") {
    throw new ForbiddenError("OWNER_REQUIRED");
  }
}
