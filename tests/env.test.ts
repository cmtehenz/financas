import { describe, expect, it } from "vitest";

import {
  getMissingRequiredEnv,
  isOpenAiConfigured,
  parseServerEnv,
  requireServerEnv,
} from "@/lib/env";

const validRequired = {
  DATABASE_URL: "postgresql://user:pass@localhost/financeiro",
  BETTER_AUTH_SECRET: "a-very-long-secret-of-at-least-32-chars",
  BETTER_AUTH_URL: "http://localhost:3000",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
};

describe("parseServerEnv", () => {
  it("accepts a complete configuration", () => {
    const env = parseServerEnv(validRequired);

    expect(env.DATABASE_URL).toBe(validRequired.DATABASE_URL);
    expect(isOpenAiConfigured(env)).toBe(false);
  });

  it("treats empty optional OpenAI values as disabled", () => {
    const env = parseServerEnv({
      ...validRequired,
      OPENAI_API_KEY: "",
      OPENAI_MODEL: "",
    });

    expect(env.OPENAI_API_KEY).toBeUndefined();
    expect(isOpenAiConfigured(env)).toBe(false);
  });

  it("does not require OpenAI to parse the rest of the app", () => {
    expect(() => parseServerEnv(validRequired)).not.toThrow();
    expect(getMissingRequiredEnv(parseServerEnv(validRequired))).toEqual([]);
  });

  it("lists missing required variables without failing the parser", () => {
    const env = parseServerEnv({});

    expect(getMissingRequiredEnv(env)).toEqual([
      "DATABASE_URL",
      "BETTER_AUTH_SECRET",
      "BETTER_AUTH_URL",
    ]);
  });

  it("throws only when required variables are demanded", () => {
    expect(() => requireServerEnv({})).toThrow(/Missing required environment variables/);
  });

  it("rejects a short auth secret", () => {
    expect(() =>
      parseServerEnv({
        ...validRequired,
        BETTER_AUTH_SECRET: "short",
      }),
    ).toThrow();
  });
});
