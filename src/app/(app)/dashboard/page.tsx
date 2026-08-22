import type { Metadata } from "next";

import { LogoutButton } from "@/features/auth/logout-button";
import { requireSession } from "@/lib/require-session";

export const metadata: Metadata = {
  title: "Início",
};

export default async function DashboardPage() {
  const session = await requireSession();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Olá, {session.user.name}</p>
          <h1 className="font-heading mt-1 text-3xl tracking-tight">Início</h1>
        </div>
        <LogoutButton />
      </header>
      <section className="mt-10">
        <p className="text-sm font-medium text-muted-foreground">Saldo realmente disponível</p>
        <p className="font-heading mt-2 text-4xl tracking-tight sm:text-5xl">R$ —</p>
        <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
          Este número passa a aparecer quando a Casa, as contas e as movimentações
          forem cadastradas. Nada aqui é dado fictício.
        </p>
      </section>
      <section className="mt-10 rounded-2xl border border-dashed border-border bg-card px-5 py-6">
        <h2 className="font-medium">Próximo passo</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          A Fase 2 cria a Casa compartilhada, o convite e as categorias iniciais.
          Sua sessão já está persistida no banco.
        </p>
      </section>
    </div>
  );
}
