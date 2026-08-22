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
      <AppNav className="flex items-center gap-1 overflow-x-auto px-2 py-2 text-xs" />
    </div>
  );
}
