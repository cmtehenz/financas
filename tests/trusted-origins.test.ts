import { describe, expect, it } from "vitest";

import {
  getAppBaseUrl,
  getTrustedOrigins,
  isAllowedVercelHost,
} from "@/lib/trusted-origins";

describe("getTrustedOrigins", () => {
  it("includes localhost and 127.0.0.1 for local development", () => {
    expect(getTrustedOrigins("http://localhost:3000", {})).toEqual([
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]);
  });

  it("accepts only matching Vercel project hosts", () => {
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

  it("ignores localhost BETTER_AUTH_URL on Vercel production", () => {
    expect(
      getAppBaseUrl("http://localhost:3000", {
        VERCEL_ENV: "production",
        VERCEL_URL: "financas-abc.vercel.app",
        VERCEL_PROJECT_PRODUCTION_URL: "financas.vercel.app",
      }),
    ).toBe("https://financas.vercel.app");
  });

  it("trusts the current Vercel deployment and production host", () => {
    expect(
      getTrustedOrigins("https://financas.vercel.app", {
        VERCEL_ENV: "production",
        VERCEL_URL: "financas-abc.vercel.app",
        VERCEL_PROJECT_PRODUCTION_URL: "financas.vercel.app",
      }),
    ).toEqual(["https://financas.vercel.app", "https://financas-abc.vercel.app"]);
  });

  it("trusts an explicit extra origin from env", () => {
    expect(
      getTrustedOrigins("https://financas.vercel.app", {
        BETTER_AUTH_TRUSTED_ORIGINS: "https://casa.example.com",
      }),
    ).toEqual(["https://financas.vercel.app", "https://casa.example.com"]);
  });
});
