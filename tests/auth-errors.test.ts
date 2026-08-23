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

  it("maps missing production secrets to a configuration hint", () => {
    expect(toPublicAuthError(new Error("DATABASE_URL is not configured"))).toBe(
      "O ambiente de produção está incompleto. Confira DATABASE_URL e BETTER_AUTH_SECRET na Vercel.",
    );
  });
});
