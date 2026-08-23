import type { ReactNode } from "react";
import Link from "next/link";

import { PLANNING_MONTH_LABELS, planningPath } from "@/domain/planning";
import { cn } from "@/lib/utils";

export function PlanningMonthNav({
  year,
  month,
  extra,
}: {
  year: number;
  month: number;
  extra?: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
          <Link
            href={planningPath(year - 1, month)}
            className="text-secondary inline-flex min-h-11 items-center rounded-xl border border-border bg-card px-3"
            data-testid="planning-prev-year"
          >
            Ano anterior
          </Link>
          <p className="text-money text-lg" data-testid="planning-year">
            {year}
          </p>
          <Link
            href={planningPath(year + 1, month)}
            className="text-secondary inline-flex min-h-11 items-center rounded-xl border border-border bg-card px-3"
            data-testid="planning-next-year"
          >
            Próximo ano
          </Link>
        </div>
        {extra ? <div className="sm:shrink-0">{extra}</div> : null}
      </div>
      <nav
        aria-label="Meses do planner"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
        data-testid="planning-month-tabs"
      >
        {PLANNING_MONTH_LABELS.map((label, index) => {
          const value = index + 1;
          const selected = value === month;
          return (
            <Link
              key={label}
              href={planningPath(year, value)}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm font-medium whitespace-nowrap transition-colors",
                selected
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              data-testid={`planning-month-${value}`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
