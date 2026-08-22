import type { Metadata } from "next";

import { requireCompletedHousehold } from "@/lib/require-household";
import { getHouseholdDashboard } from "@/services/dashboard";

export const metadata: Metadata = {
  title: "Início",
};

export default async function DashboardPage() {
  const { session, household } = await requireCompletedHousehold();
  const dashboard = await getHouseholdDashboard(household.id);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6">
      <header>
        <p className="text-sm text-muted-foreground">Olá, {session.user.name}</p>
        <h1 className="font-heading mt-1 text-3xl tracking-tight">{household.name}</h1>
      </header>
      <section className="mt-10">
        <p className="text-sm font-medium text-muted-foreground">Saldo realmente disponível</p>
        <p className="font-heading mt-2 text-4xl tracking-tight sm:text-5xl" data-testid="available-balance">
          {dashboard.availableLabel}
        </p>
        <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
          Soma dos saldos iniciais das contas ativas. Receitas e despesas entram na
          próxima etapa e passam a compor este número.
        </p>
      </section>
      <section className="mt-10 grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-border bg-card px-5 py-4">
          <p className="text-sm text-muted-foreground">Contas ativas</p>
          <p className="font-heading mt-1 text-2xl">{dashboard.accountCount}</p>
        </article>
        <article className="rounded-2xl border border-border bg-card px-5 py-4">
          <p className="text-sm text-muted-foreground">Membros</p>
          <p className="font-heading mt-1 text-2xl">{dashboard.memberCount}</p>
        </article>
        <article className="rounded-2xl border border-border bg-card px-5 py-4">
          <p className="text-sm text-muted-foreground">Convite</p>
          <p className="font-heading mt-1 text-lg">
            {dashboard.hasPendingInvite ? "Pendente" : "Nenhum pendente"}
          </p>
        </article>
      </section>
      <section className="mt-8 rounded-2xl border border-dashed border-border bg-card px-5 py-6">
        <h2 className="font-medium">Próximo passo</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          As movimentações de receitas e despesas entram na Fase 3. As {dashboard.categoryCount}{" "}
          categorias iniciais já estão na Casa.
        </p>
      </section>
    </div>
  );
}
