import type { Metadata } from "next";

import { AuthShell } from "@/features/auth/auth-shell";
import { SignupForm } from "@/features/auth/signup-form";

export const metadata: Metadata = {
  title: "Criar conta",
};

export default function SignupPage() {
  return (
    <AuthShell
      title="Criar conta"
      description="Cadastre-se com nome, e-mail e senha. Depois você poderá criar a Casa e convidar sua esposa."
    >
      <SignupForm />
    </AuthShell>
  );
}
