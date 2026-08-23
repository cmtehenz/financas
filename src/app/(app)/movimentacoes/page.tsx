import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { EmptyState, MoneyText, PageHeader, PageShell } from "@/features/app/ui";
import { TransactionActions } from "@/features/ledger/transaction-actions";
import { TRANSACTION_STATUS_LABELS, TRANSACTION_TYPE_LABELS } from "@/domain/transaction-types";
import { parseYearMonth, todayInSaoPaulo, yearMonth } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { requireCompletedHousehold } from "@/lib/require-household";
import { cn } from "@/lib/utils";
import { listHouseholdAccounts } from "@/services/accounts";
import { listHouseholdCategories } from "@/services/categories";
import { listHouseholdMembers } from "@/services/households";
import { materializeRecurrencesForMonth } from "@/services/recurrences";
import { listHouseholdTransactions } from "@/services/transactions";

export const metadata: Metadata = {
  title: "Movimentações",
};

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { session, household } = await requireCompletedHousehold();
  const params = await searchParams;
  const month = typeof params.mes === "string" ? params.mes : todayInSaoPaulo().slice(0, 7);
  const parsed = parseYearMonth(month);
  await materializeRecurrencesForMonth({
    userId: session.user.id,
    householdId: household.id,
    year: parsed.year,
    month: parsed.month,
  });

  const filters = {
    month: yearMonth(parsed.year, parsed.month),
    accountId: typeof params.conta === "string" ? params.conta : undefined,
    categoryId: typeof params.categoria === "string" ? params.categoria : undefined,
    type: typeof params.tipo === "string" ? (params.tipo as "INCOME" | "EXPENSE" | "TRANSFER") : undefined,
    status: typeof params.situacao === "string" ? (params.situacao as "PLANNED" | "PENDING" | "PAID" | "CANCELLED") : undefined,
    q: typeof params.q === "string" ? params.q : undefined,
    page: typeof params.pagina === "string" ? Number(params.pagina) : 1,
  };

  const [list, accounts, categories, members] = await Promise.all([
    listHouseholdTransactions(household.id, filters),
    listHouseholdAccounts(household.id),
    listHouseholdCategories(household.id),
    listHouseholdMembers(household.id),
  ]);

  const query = new URLSearchParams();
  query.set("mes", filters.month);
  if (filters.accountId) query.set("conta", filters.accountId);
  if (filters.categoryId) query.set("categoria", filters.categoryId);
  if (filters.type) query.set("tipo", filters.type);
  if (filters.status) query.set("situacao", filters.status);
  if (filters.q) query.set("q", filters.q);

  return (
    <PageShell>
      <PageHeader
        title="Movimentações"
        description="Receitas, despesas e transferências da Casa."
        actions={
          <Link href="/movimentacoes/nova" className={cn(buttonVariants(), "h-11")}>
            Nova movimentação
          </Link>
        }
      />

      <form className="surface grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3" method="get">
        <div className="space-y-1.5">
          <label htmlFor="filtro-mes" className="text-label">
            Mês
          </label>
          <input id="filtro-mes" type="month" name="mes" defaultValue={filters.month} className="field-control" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="filtro-q" className="text-label">
            Buscar
          </label>
          <input
            id="filtro-q"
            name="q"
            defaultValue={filters.q}
            placeholder="Buscar"
            className="field-control"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="filtro-conta" className="text-label">
            Conta
          </label>
          <select id="filtro-conta" name="conta" defaultValue={filters.accountId ?? ""} className="field-control">
            <option value="">Todas as contas</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="filtro-categoria" className="text-label">
            Categoria
          </label>
          <select id="filtro-categoria" name="categoria" defaultValue={filters.categoryId ?? ""} className="field-control">
            <option value="">Todas as categorias</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="filtro-tipo" className="text-label">
            Tipo
          </label>
          <select id="filtro-tipo" name="tipo" defaultValue={filters.type ?? ""} className="field-control">
            <option value="">Todos os tipos</option>
            <option value="INCOME">Receita</option>
            <option value="EXPENSE">Despesa</option>
            <option value="TRANSFER">Transferência</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="filtro-situacao" className="text-label">
            Situação
          </label>
          <select id="filtro-situacao" name="situacao" defaultValue={filters.status ?? ""} className="field-control">
            <option value="">Todas as situações</option>
            <option value="PLANNED">Prevista</option>
            <option value="PENDING">Pendente</option>
            <option value="PAID">Paga</option>
            <option value="CANCELLED">Cancelada</option>
          </select>
        </div>
        <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "h-11 self-end")}>
          Filtrar
        </button>
      </form>

      {list.rows.length === 0 ? (
        <EmptyState>Nenhuma movimentação neste filtro.</EmptyState>
      ) : (
        <div className="surface overflow-x-auto">
          <div className="text-label hidden min-w-[48rem] grid-cols-[minmax(0,1.6fr)_minmax(10rem,auto)_8rem_8rem_minmax(12rem,auto)] gap-3 border-b border-border bg-muted/60 px-4 py-2.5 lg:grid">
            <span>Descrição</span>
            <span>Tipo e situação</span>
            <span>Data</span>
            <span className="text-right">Valor</span>
            <span className="text-right">Ações</span>
          </div>
          <ul>
            {list.rows.map((item) => (
              <li key={item.id} className="space-y-3 border-b border-border px-4 py-4 last:border-b-0 lg:grid lg:min-w-[48rem] lg:grid-cols-[minmax(0,1.6fr)_minmax(10rem,auto)_8rem_8rem_minmax(12rem,auto)] lg:items-center lg:gap-3 lg:space-y-0">
                <div>
                  <p className="text-card-title">{item.description}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.type === "TRANSFER"
                      ? `${accounts.find((account) => account.id === item.accountId)?.name ?? "Conta"} → ${accounts.find((account) => account.id === item.destinationAccountId)?.name ?? "Destino"}`
                      : `${categories.find((category) => category.id === item.categoryId)?.name ?? "Categoria"} · ${accounts.find((account) => account.id === item.accountId)?.name ?? "Conta"}`}
                    {" · "}
                    {item.assignedToUserId
                      ? (members.find((member) => member.userId === item.assignedToUserId)?.name ?? "Responsável")
                      : "Compartilhado"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:contents">
                  <p className="text-sm text-muted-foreground">
                    {TRANSACTION_TYPE_LABELS[item.type as keyof typeof TRANSACTION_TYPE_LABELS]} ·{" "}
                    {TRANSACTION_STATUS_LABELS[item.status as keyof typeof TRANSACTION_STATUS_LABELS]}
                    {item.recurringRuleId ? " · recorrente" : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {item.transactionDate}
                  </p>
                  <MoneyText
                    className="text-xl lg:text-right lg:text-base"
                    tone={item.type === "INCOME" ? "success" : item.type === "EXPENSE" ? "danger" : "default"}
                  >
                    {formatBRL(item.amountCents)}
                  </MoneyText>
                </div>
                <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                  <Link href={`/movimentacoes/${item.id}`} className="text-sm underline">
                    Editar
                  </Link>
                  <TransactionActions transactionId={item.id} status={item.status} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-3">
        {list.page > 1 ? (
          <Link href={`/movimentacoes?${query.toString()}&pagina=${list.page - 1}`} className="text-sm underline">
            Anterior
          </Link>
        ) : null}
        {list.rows.length === list.pageSize ? (
          <Link href={`/movimentacoes?${query.toString()}&pagina=${list.page + 1}`} className="text-sm underline">
            Próxima
          </Link>
        ) : null}
      </div>
    </PageShell>
  );
}
