import { describe, expect, it } from "vitest";

import { assertSession, UnauthorizedError } from "@/lib/session";

describe("assertSession", () => {
  it("accepts an authenticated session", () => {
    const session = { user: { id: "user_1", name: "Gustavo" } };

    expect(() => assertSession(session)).not.toThrow();
  });

  it("rejects a missing session", () => {
    expect(() => assertSession(null)).toThrow(UnauthorizedError);
    expect(() => assertSession(undefined)).toThrow(/UNAUTHENTICATED/);
  });
});
