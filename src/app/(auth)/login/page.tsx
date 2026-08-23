import type { Metadata } from "next";

import { AuthShell } from "@/features/auth/auth-shell";
import { LoginForm } from "@/features/auth/login-form";
import { redirectIfAuthenticated } from "@/lib/require-session";
import { getSafeInternalPath } from "@/lib/safe-redirect";

export const metadata: Metadata = {
  title: "Entrar",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = getSafeInternalPath(params.next);
  await redirectIfAuthenticated(next);

  return (
    <AuthShell
      title="Entrar"
      description="Acesse a Casa financeira com o e-mail e a senha da sua conta."
    >
      <LoginForm next={next} />
    </AuthShell>
  );
}
