import type { Metadata } from "next";

import { AuthShell } from "@/features/auth/auth-shell";
import { SignupForm } from "@/features/auth/signup-form";
import { getSafeInternalPath } from "@/lib/safe-redirect";

export const metadata: Metadata = {
  title: "Criar conta",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = getSafeInternalPath(params.next);

  return (
    <AuthShell
      title="Criar conta"
      description="Cadastre-se com nome, e-mail e senha. Depois você poderá criar a Casa e convidar sua esposa."
    >
      <SignupForm next={next} />
    </AuthShell>
  );
}
