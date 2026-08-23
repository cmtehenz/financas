import Link from "next/link";

import { StatCard } from "@/features/app/ui";
import type { MonthlyPlanningBoard } from "@/services/planning";

import { PlanningLists } from "./planning-lists";

type AccountOption = { id: string; name: string; active: boolean };
type CategoryOption = { id: string; name: string; type: string; active: boolean };

export function PlanningBoard({
  board,
  accounts,
  categories,
  today,
}: {
  board: MonthlyPlanningBoard;
  accounts: AccountOption[];
  categories: CategoryOption[];
  today: string;
}) {
  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="planning-summary">
        <StatCard label="Entradas previstas" value={board.totals.plannedIncomeLabel} testId="planning-planned-income" tone="success" />
        <StatCard label="Entradas recebidas" value={board.totals.receivedIncomeLabel} testId="planning-received-income" tone="success" />
        <StatCard label="Total de contas" value={board.totals.billsTotalLabel} testId="planning-bills-total" tone="danger" />
        <StatCard label="Total já pago" value={board.totals.paidBillsLabel} testId="planning-paid-total" />
        <StatCard label="Falta pagar" value={board.totals.remainingToPayLabel} testId="planning-remaining" tone="warning" />
        <StatCard
          label="Saldo planejado do mês"
          value={board.totals.plannedBalanceLabel}
          testId="planning-planned-balance"
          tone={board.totals.plannedBalanceLabel.startsWith("-") ? "danger" : "default"}
        />
        <StatCard label="Saldo realmente disponível" value={board.totals.availableLabel} testId="planning-available" />
      </section>

      <PlanningLists board={board} accounts={accounts} categories={categories} today={today} />

      <p className="text-sm text-muted-foreground">
        O saldo planejado é o resultado previsto do mês e não muda quando uma conta é marcada como
        paga. O disponível continua sendo o saldo oficial da Casa.{" "}
        <Link href="/dashboard" className="underline">
          Início
        </Link>
        {" · "}
        <Link href={`/orcamento?mes=${board.monthKey}`} className="underline">
          Orçamento
        </Link>
      </p>
    </div>
  );
}
