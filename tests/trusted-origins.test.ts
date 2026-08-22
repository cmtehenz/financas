import { describe, expect, it } from "vitest";

import { getTrustedOrigins } from "@/lib/trusted-origins";

describe("getTrustedOrigins", () => {
  it("includes localhost and 127.0.0.1 for local development", () => {
    expect(getTrustedOrigins("http://localhost:3000")).toEqual([
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]);
  });
});
