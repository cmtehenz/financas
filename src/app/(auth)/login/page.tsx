import type { Metadata } from "next";

import { AuthShell } from "@/features/auth/auth-shell";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = {
  title: "Entrar",
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Entrar"
      description="Acesse a Casa financeira com o e-mail e a senha da sua conta."
    >
      <LoginForm />
    </AuthShell>
  );
}
