import Link from "next/link";

import { EmptyState, MoneyText, StatCard, StatusBadge } from "@/features/app/ui";
import { TransactionForm } from "@/features/ledger/transaction-form";
import { planningPath } from "@/domain/planning";
import { occurrenceDate } from "@/lib/dates";
import type { MonthlyPlanningBoard } from "@/services/planning";

import {
  PlanningCardPay,
  PlanningCopyForm,
  PlanningDebtPay,
  PlanningRecurringForm,
  PlanningSettleForm,
  PlanningStatusButtons,
} from "./planning-forms";

type FormLookups = {
  accounts: Array<{ id: string; name: string; active: boolean }>;
  categories: Array<{ id: string; name: string; type: string; active: boolean }>;
  members: Array<{ userId: string; name: string }>;
};

export function PlanningBoard({
  board,
  lookups,
  today,
}: {
  board: MonthlyPlanningBoard;
  lookups: FormLookups;
  today: string;
}) {
  const returnTo = planningPath(board.year, board.month);
  const defaultDate = occurrenceDate(board.year, board.month, Number(today.slice(8, 10)));
  const defaultAccountId = lookups.accounts.find((account) => account.active)?.id ?? "";

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

      <PlanningCopyForm year={board.year} month={board.month} items={board.copyPreview} />

      {board.empty ? (
        <EmptyState testId="planning-empty">
          Nenhum lançamento neste mês. Crie entradas, contas ou copie o mês anterior.
        </EmptyState>
      ) : null}

      <div className="grid gap-8">
        <section className="space-y-4" data-testid="planning-incomes">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-section-title">Entradas</h2>
            <p className="text-sm text-muted-foreground">Total {board.totals.plannedIncomeLabel}</p>
          </div>
          <details className="surface p-4">
            <summary className="cursor-pointer text-sm font-medium">Criar entrada</summary>
            <div className="mt-4">
              <TransactionForm
                accounts={lookups.accounts}
                categories={lookups.categories}
                members={lookups.members}
                defaultDate={defaultDate}
                redirectTo={returnTo}
                idPrefix="planning-income-"
                defaultValues={{ type: "INCOME", status: "PLANNED", transactionDate: defaultDate }}
              />
            </div>
          </details>
          {board.incomes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma entrada neste mês.</p>
          ) : (
            <div className="surface overflow-x-auto">
              <div className="hidden min-w-[40rem] grid-cols-[minmax(0,1.4fr)_8rem_7rem_8rem] gap-3 border-b border-border bg-muted/60 px-4 py-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase lg:grid">
                <span>Entrada</span>
                <span>Responsável</span>
                <span>Situação</span>
                <span className="text-right">Valor</span>
              </div>
              <ul>
              {board.incomes.map((item) => (
                <li key={item.id} className="border-b border-border px-4 py-3 last:border-b-0 lg:min-w-[40rem]">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_8rem_7rem_8rem] lg:items-center">
                    <div>
                      <p className="font-medium">{item.description}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.expectedDateLabel} · {item.accountName}
                      </p>
                    </div>
                    <p className="hidden text-sm text-muted-foreground lg:block">{item.assigneeName}</p>
                    <StatusBadge tone={statusTone(item.visualStatus)}>{item.statusLabel}</StatusBadge>
                    <MoneyText className="text-lg lg:text-right" tone="success">
                      {item.amountLabel}
                    </MoneyText>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm">
                    <Link href={`/movimentacoes/${item.id}`} className="underline">
                      Editar
                    </Link>
                    <span>Destino: {item.accountName}</span>
                  </div>
                  {item.canReceive ? (
                    <div className="mt-3">
                      <PlanningSettleForm
                        itemId={item.id}
                        kind="LEDGER"
                        defaultAmountCents={item.amountCents}
                        defaultAccountId={item.accountId}
                        defaultDate={today}
                        accounts={lookups.accounts}
                        year={board.year}
                        month={board.month}
                        confirmLabel="Marcar como recebida"
                      />
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-col gap-3">
                    <PlanningStatusButtons transactionId={item.id} showPending={item.visualStatus === "PAGA"} />
                    {item.recurring ? null : <PlanningRecurringForm transactionId={item.id} />}
                  </div>
                </li>
              ))}
              </ul>
            </div>
          )}
        </section>

        <section className="space-y-4" data-testid="planning-bills">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-section-title">Contas a pagar</h2>
            <p className="text-sm text-muted-foreground">Total {board.totals.billsTotalLabel}</p>
          </div>
          <details className="surface p-4">
            <summary className="cursor-pointer text-sm font-medium">Criar conta</summary>
            <div className="mt-4">
              <TransactionForm
                accounts={lookups.accounts}
                categories={lookups.categories}
                members={lookups.members}
                defaultDate={defaultDate}
                redirectTo={returnTo}
                idPrefix="planning-bill-"
                defaultValues={{ type: "EXPENSE", status: "PLANNED", transactionDate: defaultDate }}
              />
            </div>
          </details>
          {board.bills.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma conta neste mês.</p>
          ) : (
            <div className="surface overflow-x-auto">
              <div className="hidden min-w-[48rem] grid-cols-[minmax(0,1.3fr)_6rem_8rem_7rem_8rem] gap-3 border-b border-border bg-muted/60 px-4 py-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase lg:grid">
                <span>Conta</span>
                <span>Origem</span>
                <span>Vencimento</span>
                <span>Situação</span>
                <span className="text-right">Valor</span>
              </div>
              <ul>
              {board.bills.map((item) => (
                <li key={item.id} className="border-b border-border px-4 py-3 last:border-b-0 lg:min-w-[48rem]">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_6rem_8rem_7rem_8rem] lg:items-center">
                    <div>
                      <p className="font-medium">{item.description}</p>
                      <p className="mt-1 text-sm text-muted-foreground lg:hidden">
                        {item.originLabel} · {item.dueDateLabel} · {item.assigneeName}
                      </p>
                    </div>
                    <p className="hidden text-sm text-muted-foreground lg:block">{item.originLabel}</p>
                    <p className="hidden text-sm text-muted-foreground lg:block">{item.dueDateLabel}</p>
                    <StatusBadge tone={statusTone(item.visualStatus)}>{item.statusLabel}</StatusBadge>
                    <MoneyText className="text-lg lg:text-right" tone="danger">
                      {item.amountLabel}
                    </MoneyText>
                  </div>
                  {item.origin === "LEDGER" || item.origin === "RECURRING" || (item.origin === "INVESTMENT" && !item.id.startsWith("investment:")) ? (
                    <div className="mt-3 flex flex-wrap gap-3 text-sm">
                      <Link href={`/movimentacoes/${item.sourceId}`} className="underline">
                        Editar
                      </Link>
                      <PlanningStatusButtons transactionId={item.sourceId} />
                      {item.origin === "RECURRING" ? null : <PlanningRecurringForm transactionId={item.sourceId} />}
                    </div>
                  ) : null}
                  {item.canPay &&
                  (item.origin === "LEDGER" ||
                    item.origin === "RECURRING" ||
                    (item.origin === "INVESTMENT" && !item.id.startsWith("investment:"))) ? (
                    <div className="mt-3">
                      <PlanningSettleForm
                        itemId={item.sourceId}
                        kind="LEDGER"
                        defaultAmountCents={item.amountCents}
                        defaultAccountId={defaultAccountId}
                        defaultDate={today}
                        accounts={lookups.accounts}
                        year={board.year}
                        month={board.month}
                        confirmLabel="Marcar como paga"
                      />
                    </div>
                  ) : null}
                  {item.canPay && item.origin === "INVESTMENT" && item.id.startsWith("investment:") ? (
                    <div className="mt-3">
                      <PlanningSettleForm
                        itemId={item.id}
                        kind="INVESTMENT"
                        defaultAmountCents={item.amountCents}
                        defaultAccountId={defaultAccountId}
                        defaultDate={today}
                        accounts={lookups.accounts}
                        year={board.year}
                        month={board.month}
                        confirmLabel="Registrar investimento"
                      />
                    </div>
                  ) : null}
                  {item.canPay && item.origin === "CARD" && item.statementId && item.pendingLabel ? (
                    <div className="mt-3">
                      <PlanningCardPay
                        statementId={item.statementId}
                        pendingLabel={item.pendingLabel}
                        accounts={lookups.accounts}
                        defaultDate={today}
                      />
                    </div>
                  ) : null}
                  {item.canPay && item.origin === "DEBT" && item.debtId && item.installmentId ? (
                    <div className="mt-3">
                      <PlanningDebtPay
                        debtId={item.debtId}
                        installmentId={item.installmentId}
                        accounts={lookups.accounts}
                      />
                    </div>
                  ) : null}
                </li>
              ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function statusTone(status: string) {
  if (status === "PAGA") {
    return "success" as const;
  }
  if (status === "VENCIDA" || status === "CANCELADA") {
    return "danger" as const;
  }
  if (status === "A_DEFINIR" || status === "PENDENTE") {
    return "warning" as const;
  }
  return "info" as const;
}
