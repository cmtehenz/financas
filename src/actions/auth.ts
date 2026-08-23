"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuth } from "@/lib/auth";
import { toPublicAuthError } from "@/lib/auth-errors";
import {
  requestPasswordResetSchema,
  signInSchema,
  signUpSchema,
  type RequestPasswordResetInput,
  type SignInInput,
  type SignUpInput,
} from "@/lib/validations/auth";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function signUpAction(input: SignUpInput): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    await getAuth().api.signUpEmail({
      body: {
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
      },
      headers: await headers(),
    });

    return { ok: true };
  } catch (error) {
    console.error("auth.sign_up_failed", error instanceof Error ? error.message : "unknown");
    return { ok: false, error: toPublicAuthError(error) };
  }
}

export async function signInAction(input: SignInInput): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    await getAuth().api.signInEmail({
      body: {
        email: parsed.data.email,
        password: parsed.data.password,
      },
      headers: await headers(),
    });

    return { ok: true };
  } catch (error) {
    console.error("auth.sign_in_failed", error instanceof Error ? error.message : "unknown");
    return { ok: false, error: toPublicAuthError(error) };
  }
}

export async function requestPasswordResetAction(
  input: RequestPasswordResetInput,
): Promise<ActionResult> {
  const parsed = requestPasswordResetSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    await getAuth().api.requestPasswordReset({
      body: {
        email: parsed.data.email,
        redirectTo: "/recuperar-acesso",
      },
      headers: await headers(),
    });
  } catch {
    // Always return success to avoid leaking whether the e-mail exists.
  }

  return { ok: true };
}

export async function signOutAction() {
  await getAuth().api.signOut({
    headers: await headers(),
  });

  redirect("/login");
}
