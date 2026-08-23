import { describe, expect, it } from "vitest";

import { toPublicAuthError } from "@/lib/auth-errors";

describe("toPublicAuthError", () => {
  it("maps invalid origin to a production configuration hint", () => {
    expect(toPublicAuthError(new Error("Invalid origin"))).toBe(
      "O endereço do site não está autorizado para login. Confira BETTER_AUTH_URL na Vercel.",
    );
  });

  it("keeps invalid credentials specific", () => {
    expect(toPublicAuthError(new Error("Invalid email or password"))).toBe("E-mail ou senha inválidos.");
  });
});
