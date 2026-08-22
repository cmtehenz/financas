import { describe, expect, it } from "vitest";

import { signInSchema, signUpSchema } from "@/lib/validations/auth";

describe("auth validation", () => {
  it("normalizes signup e-mail and accepts a valid payload", () => {
    const parsed = signUpSchema.parse({
      name: "Gustavo",
      email: "  Gustavo@Example.com ",
      password: "senha-segura",
      confirmPassword: "senha-segura",
    });

    expect(parsed.email).toBe("gustavo@example.com");
  });

  it("rejects mismatched passwords", () => {
    const parsed = signUpSchema.safeParse({
      name: "Gustavo",
      email: "gustavo@example.com",
      password: "senha-segura",
      confirmPassword: "outra-senha",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects an empty login password", () => {
    const parsed = signInSchema.safeParse({
      email: "gustavo@example.com",
      password: "",
    });

    expect(parsed.success).toBe(false);
  });
});
