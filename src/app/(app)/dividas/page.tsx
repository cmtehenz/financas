import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
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
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-8 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl tracking-tight">Dívidas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Saldo devedor {formatBRL(state.outstandingCents)}
          </p>
        </div>
        <Link href="/dividas/nova" className={cn(buttonVariants(), "h-11")}>
          Nova dívida
        </Link>
      </header>

      {state.debts.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">Nenhuma dívida cadastrada.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {state.debts.map((debt) => {
            const next = state.installments
              .filter((item) => item.debtId === debt.id && (item.status === "PENDING" || item.status === "OVERDUE"))
              .sort((left, right) => left.dueDate.localeCompare(right.dueDate))[0];
            return (
              <li key={debt.id} className="rounded-2xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{debt.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {debt.creditor} · {debt.status}
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
    </div>
  );
}
