"use client";

import { LogoutButton } from "@/features/auth/logout-button";

import { APP_LINKS, AppNav } from "./app-nav";

export function AppHeader({
  householdName,
  userName,
}: {
  householdName?: string;
  userName?: string;
}) {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex w-full max-w-360 items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="text-sm font-medium tracking-[-0.01em]">Financeiro Familiar</p>
          {householdName ? (
            <p className="text-caption truncate">{householdName}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {userName ? (
            <p className="text-secondary hidden max-w-40 truncate sm:block">{userName}</p>
          ) : null}
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}

export function AppSidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-sidebar lg:block">
      <div className="sticky top-0 flex h-[calc(100vh-3.5rem)] flex-col justify-between p-4">
        <AppNav className="flex flex-col gap-1" links={APP_LINKS.slice(0, 6)} />
        <AppNav className="flex flex-col gap-1 border-t border-border pt-4" links={APP_LINKS.slice(6)} />
      </div>
    </aside>
  );
}

export function AppBottomNav() {
  return (
    <div className="sticky bottom-0 z-20 border-t border-border bg-card lg:hidden pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="flex items-stretch gap-1 overflow-x-auto px-2 pt-1">
        <AppNav
          className="flex flex-1 items-stretch gap-1"
          variant="bottom"
          links={APP_LINKS.slice(0, 4)}
        />
        <details className="relative">
          <summary className="flex min-h-11 min-w-16 cursor-pointer list-none flex-col items-center justify-center rounded-xl px-2 py-2 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground">
            Mais
          </summary>
          <div className="absolute right-0 bottom-full mb-2 min-w-44 rounded-2xl border border-border bg-card p-2 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
            <AppNav className="flex flex-col gap-1" variant="menu" links={APP_LINKS.slice(4)} />
          </div>
        </details>
      </div>
    </div>
  );
}
