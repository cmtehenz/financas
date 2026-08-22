import type { Metadata } from "next";

import { AuthShell } from "@/features/auth/auth-shell";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Recuperar acesso",
};

export default function RecoverAccessPage() {
  return (
    <AuthShell
      title="Recuperar acesso"
      description="Informe o e-mail da conta. O envio de mensagem fica preparado e desativado no ambiente local."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
