import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageShell({
  children,
  width = "default",
  className,
}: {
  children: ReactNode;
  width?: "narrow" | "default" | "wide";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-1 flex-col gap-8 px-4 py-6 pb-24 sm:px-6 sm:py-8 lg:pb-10",
        width === "narrow" && "max-w-3xl",
        width === "default" && "max-w-5xl",
        width === "wide" && "max-w-6xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-page-title">{title}</h1>
        {description ? <div className="text-page-subtitle mt-1">{description}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Surface({
  children,
  className,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "article" | "div" | "li";
}) {
  return <Tag className={cn("surface p-5", className)}>{children}</Tag>;
}

export function StatCard({
  label,
  value,
  hint,
  testId,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  testId?: string;
  tone?: "default" | "success" | "danger" | "warning";
}) {
  return (
    <article className="surface p-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p
        className={cn(
          "text-money mt-2 text-2xl",
          tone === "success" && "text-success",
          tone === "danger" && "text-danger",
          tone === "warning" && "text-warning",
        )}
        data-testid={testId}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
    </article>
  );
}

export function MoneyText({
  children,
  className,
  tone = "default",
  testId,
}: {
  children: ReactNode;
  className?: string;
  tone?: "default" | "success" | "danger" | "warning";
  testId?: string;
}) {
  return (
    <span
      data-testid={testId}
      className={cn(
        "text-money",
        tone === "success" && "text-success",
        tone === "danger" && "text-danger",
        tone === "warning" && "text-warning",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        tone === "neutral" && "bg-muted text-muted-foreground",
        tone === "success" && "bg-emerald-50 text-success",
        tone === "warning" && "bg-amber-50 text-warning",
        tone === "danger" && "bg-red-50 text-danger",
        tone === "info" && "bg-accent text-accent-foreground",
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  children,
  className,
  testId,
}: {
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <p
      data-testid={testId}
      className={cn("surface border-dashed p-6 text-sm text-muted-foreground", className)}
    >
      {children}
    </p>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-muted", className)} />;
}

export function SectionTitle({
  children,
  extra,
}: {
  children: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <h2 className="text-section-title">{children}</h2>
      {extra ? <div className="text-sm text-muted-foreground">{extra}</div> : null}
    </div>
  );
}

export const fieldControlClassName = "field-control";
