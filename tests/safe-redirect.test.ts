import { describe, expect, it } from "vitest";

import { getSafeInternalPath } from "@/lib/safe-redirect";

describe("getSafeInternalPath", () => {
  it("accepts known internal destinations", () => {
    expect(getSafeInternalPath("/dashboard")).toBe("/dashboard");
    expect(getSafeInternalPath("/cartoes")).toBe("/cartoes");
    expect(getSafeInternalPath("/cartoes/novo")).toBe("/cartoes/novo");
    expect(getSafeInternalPath("/dividas/nova")).toBe("/dividas/nova");
    expect(getSafeInternalPath("/onboarding/contas")).toBe("/onboarding/contas");
    expect(getSafeInternalPath("/planejamento")).toBe("/planejamento");
    expect(getSafeInternalPath("/planejamento?ano=2026&mes=9")).toBe("/planejamento");
    expect(getSafeInternalPath("/convite/abcdefghijklmnopqrstuvwxyz012345")).toBe(
      "/convite/abcdefghijklmnopqrstuvwxyz012345",
    );
  });

  it("rejects open redirects and unknown paths", () => {
    expect(getSafeInternalPath("https://evil.test")).toBe("/dashboard");
    expect(getSafeInternalPath("//evil.test")).toBe("/dashboard");
    expect(getSafeInternalPath("/login")).toBe("/dashboard");
    expect(getSafeInternalPath("/convite/short")).toBe("/dashboard");
  });
});
