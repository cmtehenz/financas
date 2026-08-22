import Link from "next/link";

import { LogoutButton } from "@/features/auth/logout-button";

export function AppHeader({
  householdName,
  showNav,
}: {
  householdName?: string;
  showNav?: boolean;
}) {
  return (
    <header className="border-b border-border bg-card/80">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="font-heading text-sm tracking-tight">Financeiro Familiar</p>
          {householdName ? (
            <p className="truncate text-xs text-muted-foreground">{householdName}</p>
          ) : null}
        </div>
        <div className="flex min-w-0 items-center gap-2">
          {showNav ? (
            <nav className="flex max-w-[70vw] items-center gap-1 overflow-x-auto text-sm">
              <Link href="/dashboard" className="rounded-lg px-2 py-1.5 whitespace-nowrap hover:bg-muted">
                Início
              </Link>
              <Link href="/movimentacoes" className="rounded-lg px-2 py-1.5 whitespace-nowrap hover:bg-muted">
                Movimentações
              </Link>
              <Link href="/orcamento" className="rounded-lg px-2 py-1.5 whitespace-nowrap hover:bg-muted">
                Orçamento
              </Link>
              <Link href="/configuracoes" className="rounded-lg px-2 py-1.5 whitespace-nowrap hover:bg-muted">
                Configurações
              </Link>
            </nav>
          ) : null}
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
