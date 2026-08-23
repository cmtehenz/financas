import { Paperclip, Pencil, Repeat } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const SHORT_MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;

export const PLANNER_ROW_GRID =
  "md:grid-cols-[minmax(0,1.5fr)_5.5rem_minmax(8.75rem,auto)_8.75rem_2.5rem_2.5rem] md:items-center md:gap-4 md:px-1";

export function formatPlannerDate(isoDate: string | null | undefined) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return "—";
  }

  const day = Number(isoDate.slice(8, 10));
  const month = Number(isoDate.slice(5, 7));
  return `${day} ${SHORT_MONTHS[month - 1]}`;
}

export function PlannerTransactionRow({
  description,
  date,
  amountLabel,
  recurring,
  onEdit,
  onDocuments,
  documentCount = 0,
  statusControl,
}: {
  description: string;
  date: string | null | undefined;
  amountLabel: string;
  recurring?: boolean;
  onEdit?: () => void;
  onDocuments?: () => void;
  documentCount?: number;
  statusControl: ReactNode;
}) {
  const dateLabel = formatPlannerDate(date);

  return (
    <li className="group border-b border-border/70 last:border-b-0">
      <div
        className={cn(
          "grid grid-cols-[minmax(0,1fr)_auto_5rem] items-center gap-x-3 gap-y-1.5 py-3",
          PLANNER_ROW_GRID,
          "md:py-2.5 md:transition-colors md:group-hover:bg-muted/40",
        )}
      >
        <div className="col-start-1 row-start-1 min-w-0">
          <p className="flex items-center gap-1.5 text-[0.9375rem] leading-snug font-medium tracking-[-0.01em]">
            <span className="truncate">{description}</span>
            {recurring ? (
              <Repeat
                className="size-3.5 shrink-0 text-muted-foreground md:hidden"
                strokeWidth={1.75}
                aria-label="Recorrente"
              />
            ) : null}
          </p>
          {recurring ? <p className="text-caption mt-0.5 hidden md:block">Recorrente</p> : null}
        </div>

        <p className="text-money col-start-2 row-start-1 col-span-2 text-right text-[0.9375rem] tabular-nums md:col-span-1 md:col-start-4">
          {amountLabel}
        </p>

        <p className="text-secondary col-start-1 row-start-2 md:col-start-2 md:row-start-1">{dateLabel}</p>

        <div className="col-start-2 row-start-2 justify-self-end md:col-start-3 md:row-start-1 md:justify-self-start">
          {statusControl}
        </div>

        <div className="col-start-3 row-start-2 flex items-center justify-end gap-0.5 md:col-start-5 md:row-start-1 md:contents">
          {onDocuments ? (
            <button
              type="button"
              aria-label={documentCount > 0 ? `Arquivos, ${documentCount}` : "Adicionar arquivos"}
              title="Boleto, comprovante ou nota fiscal"
              data-testid="planner-documents-button"
              className="relative inline-flex size-10 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:col-start-5 md:row-start-1 md:size-9"
              onClick={onDocuments}
            >
              <Paperclip className="size-4" strokeWidth={1.75} aria-hidden="true" />
              {documentCount > 0 ? (
                <span className="absolute top-1 right-1 inline-flex min-w-3.5 items-center justify-center rounded-full bg-foreground px-1 text-[0.625rem] leading-4 font-medium text-background">
                  {documentCount}
                </span>
              ) : null}
            </button>
          ) : (
            <span className="inline-block size-10 md:col-start-5 md:row-start-1 md:size-9" aria-hidden="true" />
          )}
          {onEdit ? (
            <button
              type="button"
              aria-label="Editar lançamento"
              title="Editar lançamento"
              className="inline-flex size-10 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:col-start-6 md:row-start-1 md:size-9"
              onClick={onEdit}
            >
              <Pencil className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
          ) : (
            <span className="inline-block size-10 md:col-start-6 md:row-start-1 md:size-9" aria-hidden="true" />
          )}
        </div>
      </div>
    </li>
  );
}
