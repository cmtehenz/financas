import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { EmptyState, PageHeader, PageShell, StatusBadge } from "@/features/app/ui";
import { monthlyReleaseAfterPayoff } from "@/domain/debts";
import { formatBRL } from "@/lib/money";
import { requireCompletedHousehold } from "@/lib/require-household";
import { cn } from "@/lib/utils";
import { householdDebtState } from "@/services/debts";

export const metadata: Metadata = {
  title: "Dívidas",
};

export default async function DebtsPage() {
  const { household } = await requireCompletedHousehold();
  const state = await householdDebtState(household.id);

  return (
    <PageShell>
      <PageHeader
        title="Dívidas"
        description={`Saldo devedor ${formatBRL(state.outstandingCents)}`}
        actions={
          <Link href="/dividas/nova" className={cn(buttonVariants(), "h-11")}>
            Nova dívida
          </Link>
        }
      />

      {state.debts.length === 0 ? (
        <EmptyState>Nenhuma dívida cadastrada.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {state.debts.map((debt) => {
            const next = state.installments
              .filter((item) => item.debtId === debt.id && (item.status === "PENDING" || item.status === "OVERDUE"))
              .sort((left, right) => left.dueDate.localeCompare(right.dueDate))[0];
            return (
              <li key={debt.id} className="surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-card-title">{debt.name}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span>{debt.creditor}</span>
                      <StatusBadge tone={debt.status === "ACTIVE" ? "warning" : "neutral"}>{debt.status}</StatusBadge>
                    </p>
                  </div>
                  <Link href={`/dividas/${debt.id}`} className="text-sm underline">
                    Abrir
                  </Link>
                </div>
                <p className="mt-3 text-sm">
                  Saldo {formatBRL(debt.outstandingBalanceCents)} · parcela{" "}
                  {debt.installmentAmountCents ? formatBRL(debt.installmentAmountCents) : "—"} · pagas{" "}
                  {debt.paidInstallments}/{debt.totalInstallments ?? 0}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Próxima {next ? `${next.dueDate} · ${formatBRL(next.amountCents)}` : "nenhuma"} · após quitação
                  libera {formatBRL(monthlyReleaseAfterPayoff(debt.installmentAmountCents))}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
