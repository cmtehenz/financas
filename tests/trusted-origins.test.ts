import { describe, expect, it } from "vitest";

import { getAppBaseUrl, getTrustedOrigins, isAllowedVercelHost } from "@/lib/trusted-origins";

describe("getTrustedOrigins", () => {
  it("includes localhost and 127.0.0.1 for local development", () => {
    expect(getTrustedOrigins("http://localhost:3000", {})).toEqual([
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]);
  });

  it("accepts only financeiro-familiar Vercel hosts", () => {
    expect(isAllowedVercelHost("financeiro-familiar.vercel.app")).toBe(true);
    expect(isAllowedVercelHost("financeiro-familiar-abc-team.vercel.app")).toBe(true);
    expect(isAllowedVercelHost("other-app-abc.vercel.app")).toBe(false);
  });

  it("uses the Vercel deployment URL on preview without trusting Host", () => {
    expect(
      getAppBaseUrl("https://example.com", {
        VERCEL_ENV: "preview",
        VERCEL_URL: "financeiro-familiar-git-main-team.vercel.app",
        VERCEL_PROJECT_NAME: "financeiro-familiar",
      }),
    ).toBe("https://financeiro-familiar-git-main-team.vercel.app");
  });
});
