import Link from "next/link";

import { LogoutButton } from "@/features/auth/logout-button";
import { cn } from "@/lib/utils";

export function AppHeader({
  householdName,
  showNav,
}: {
  householdName?: string;
  showNav?: boolean;
}) {
  return (
    <header className="border-b border-border bg-card/80">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="min-w-0">
          <p className="font-heading text-sm tracking-tight">Financeiro Familiar</p>
          {householdName ? (
            <p className="truncate text-xs text-muted-foreground">{householdName}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {showNav ? (
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/dashboard"
                className={cn("rounded-lg px-2 py-1.5 hover:bg-muted", "text-foreground")}
              >
                Início
              </Link>
              <Link href="/configuracoes" className="rounded-lg px-2 py-1.5 hover:bg-muted">
                Casa
              </Link>
            </nav>
          ) : null}
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
