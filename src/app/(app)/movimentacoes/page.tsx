import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
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
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl tracking-tight">Movimentações</h1>
          <p className="mt-1 text-sm text-muted-foreground">Receitas, despesas e transferências da Casa.</p>
        </div>
        <Link href="/movimentacoes/nova" className={cn(buttonVariants(), "h-11")}>
          Nova movimentação
        </Link>
      </header>

      <form className="mt-6 grid gap-3 rounded-2xl border border-border p-4 sm:grid-cols-2 lg:grid-cols-3" method="get">
        <input type="month" name="mes" defaultValue={filters.month} className="h-11 rounded-lg border border-input px-2.5" />
        <input
          name="q"
          defaultValue={filters.q}
          placeholder="Buscar"
          className="h-11 rounded-lg border border-input px-2.5"
        />
        <select name="conta" defaultValue={filters.accountId ?? ""} className="h-11 rounded-lg border border-input px-2.5">
          <option value="">Todas as contas</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
        <select name="categoria" defaultValue={filters.categoryId ?? ""} className="h-11 rounded-lg border border-input px-2.5">
          <option value="">Todas as categorias</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select name="tipo" defaultValue={filters.type ?? ""} className="h-11 rounded-lg border border-input px-2.5">
          <option value="">Todos os tipos</option>
          <option value="INCOME">Receita</option>
          <option value="EXPENSE">Despesa</option>
          <option value="TRANSFER">Transferência</option>
        </select>
        <select name="situacao" defaultValue={filters.status ?? ""} className="h-11 rounded-lg border border-input px-2.5">
          <option value="">Todas as situações</option>
          <option value="PLANNED">Prevista</option>
          <option value="PENDING">Pendente</option>
          <option value="PAID">Paga</option>
          <option value="CANCELLED">Cancelada</option>
        </select>
        <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "h-11")}>
          Filtrar
        </button>
      </form>

      {list.rows.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">Nenhuma movimentação neste filtro.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {list.rows.map((item) => (
            <li key={item.id} className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium">{item.description}</p>
                  <p className="text-sm text-muted-foreground">
                    {TRANSACTION_TYPE_LABELS[item.type as keyof typeof TRANSACTION_TYPE_LABELS]} ·{" "}
                    {TRANSACTION_STATUS_LABELS[item.status as keyof typeof TRANSACTION_STATUS_LABELS]} ·{" "}
                    {item.transactionDate}
                    {item.recurringRuleId ? " · recorrente" : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {item.type === "TRANSFER"
                      ? `${accounts.find((account) => account.id === item.accountId)?.name ?? "Conta"} → ${accounts.find((account) => account.id === item.destinationAccountId)?.name ?? "Destino"}`
                      : `${categories.find((category) => category.id === item.categoryId)?.name ?? "Categoria"} · ${accounts.find((account) => account.id === item.accountId)?.name ?? "Conta"}`}
                    {" · "}
                    {item.assignedToUserId
                      ? (members.find((member) => member.userId === item.assignedToUserId)?.name ?? "Responsável")
                      : "Compartilhado"}
                  </p>
                </div>
                <p className="font-heading text-xl">{formatBRL(item.amountCents)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link href={`/movimentacoes/${item.id}`} className="text-sm underline">
                  Editar
                </Link>
                <TransactionActions transactionId={item.id} status={item.status} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex gap-3">
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
    </div>
  );
}
