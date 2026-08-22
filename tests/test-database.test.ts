import { describe, expect, it } from "vitest";

import { isIdentifiedTestDatabase, requireTestDatabaseUrl } from "@/lib/test-database";

describe("test database guard", () => {
  it("rejects a missing or production-equal URL", () => {
    expect(
      isIdentifiedTestDatabase(
        "postgresql://user:pass@ep-prod.us-east-2.aws.neon.tech/neondb",
        "postgresql://user:pass@ep-prod.us-east-2.aws.neon.tech/neondb",
        "test",
      ),
    ).toBe(false);
  });

  it("accepts a different URL identified as a test branch", () => {
    expect(
      isIdentifiedTestDatabase(
        "postgresql://user:pass@ep-other.us-east-2.aws.neon.tech/neondb",
        "postgresql://user:pass@ep-prod.us-east-2.aws.neon.tech/neondb",
        "test",
      ),
    ).toBe(true);
  });

  it("requires TEST_DATABASE_URL for write tests", () => {
    expect(() => requireTestDatabaseUrl({})).toThrow(/TEST_DATABASE_URL is required/);
  });

  it("still recognizes the test URL after it is applied as DATABASE_URL", () => {
    expect(
      isIdentifiedTestDatabase(
        "postgresql://user:pass@ep-other.us-east-2.aws.neon.tech/neondb",
        "postgresql://user:pass@ep-prod.us-east-2.aws.neon.tech/neondb",
        "test",
      ),
    ).toBe(true);
    expect(
      requireTestDatabaseUrl({
        TEST_DATABASE_URL: "postgresql://user:pass@ep-other.us-east-2.aws.neon.tech/neondb",
        DATABASE_URL: "postgresql://user:pass@ep-other.us-east-2.aws.neon.tech/neondb",
        FINANCEIRO_PRIMARY_DATABASE_URL: "postgresql://user:pass@ep-prod.us-east-2.aws.neon.tech/neondb",
        TEST_DATABASE_BRANCH: "test",
      }),
    ).toContain("ep-other");
  });
});
