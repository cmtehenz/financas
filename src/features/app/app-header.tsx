import { LogoutButton } from "@/features/auth/logout-button";

import { AppNav } from "./app-nav";

export function AppHeader({
  householdName,
}: {
  householdName?: string;
}) {
  return (
    <header className="border-b border-border bg-card/80">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="font-heading text-sm tracking-tight">Financeiro Familiar</p>
          {householdName ? (
            <p className="truncate text-xs text-muted-foreground">{householdName}</p>
          ) : null}
        </div>
        <LogoutButton />
      </div>
    </header>
  );
}

export function AppSidebar() {
  return (
    <aside className="hidden w-52 shrink-0 border-r border-border bg-card/50 lg:block">
      <AppNav className="sticky top-0 flex flex-col gap-1 p-4 text-sm" />
    </aside>
  );
}

export function AppBottomNav() {
  return (
    <div className="sticky bottom-0 border-t border-border bg-card/95 lg:hidden">
      <div className="flex items-center gap-1 overflow-x-auto px-2 py-2 text-xs">
        <AppNav
          className="flex items-center gap-1"
          links={[
            { href: "/dashboard", label: "Início" },
            { href: "/planejamento", label: "Planejamento" },
            { href: "/movimentacoes", label: "Movimentações" },
            { href: "/orcamento", label: "Orçamento" },
          ]}
        />
        <details className="relative">
          <summary className="cursor-pointer list-none rounded-lg px-2 py-1.5 whitespace-nowrap hover:bg-muted">
            Mais
          </summary>
          <div className="absolute right-0 bottom-full mb-2 min-w-40 rounded-xl border border-border bg-card p-2 shadow-lg">
            <AppNav
              className="flex flex-col gap-1"
              links={[
                { href: "/cartoes", label: "Cartões" },
                { href: "/dividas", label: "Dívidas" },
                { href: "/configuracoes", label: "Configurações" },
              ]}
            />
          </div>
        </details>
      </div>
    </div>
  );
}
