import type { Metadata } from "next";

import { FINANCIAL_ACCOUNT_TYPE_LABELS, type FinancialAccountType } from "@/domain/account-types";
import { CategoryForm, DeactivateCategoryButton } from "@/features/household/category-form";
import { DeactivateAccountButton } from "@/features/household/deactivate-account-button";
import { UpdateHouseholdForm } from "@/features/household/update-household-form";
import { AccountForm } from "@/features/onboarding/account-form";
import { InviteForm } from "@/features/onboarding/invite-form";
import { todayInSaoPaulo } from "@/lib/dates";
import { formatBRL, formatCentsInput } from "@/lib/money";
import { requireCompletedHousehold } from "@/lib/require-household";
import { listHouseholdAccounts } from "@/services/accounts";
import { listHouseholdCategories } from "@/services/categories";
import { listHouseholdMembers } from "@/services/households";
import { listHouseholdInvitations } from "@/services/invitations";

export const metadata: Metadata = {
  title: "Casa",
};

export default async function SettingsPage() {
  const { household, membership } = await requireCompletedHousehold();
  const isOwner = membership.role === "OWNER";
  const [accounts, members, invitations, categoryRows] = await Promise.all([
    listHouseholdAccounts(household.id),
    listHouseholdMembers(household.id),
    listHouseholdInvitations(household.id),
    listHouseholdCategories(household.id),
  ]);
  const pendingInvites = invitations.filter(
    (invitation) => !invitation.acceptedAt && !invitation.revokedAt && invitation.expiresAt > new Date(),
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-8 sm:px-6">
      <header>
        <h1 className="font-heading text-3xl tracking-tight">Configurações da Casa</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isOwner ? "Você administra esta Casa." : "Você visualiza os dados desta Casa."}
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="font-medium">Dados da Casa</h2>
        {isOwner ? (
          <UpdateHouseholdForm name={household.name} />
        ) : (
          <p>{household.name}</p>
        )}
        <p className="text-sm text-muted-foreground">
          {household.currency} · {household.timezone}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Membros</h2>
        <ul className="space-y-2">
          {members.map((member) => (
            <li key={member.id} className="rounded-2xl border border-border bg-card px-4 py-3">
              <p className="font-medium">{member.name}</p>
              <p className="text-sm text-muted-foreground">
                {member.role === "OWNER" ? "Responsável" : "Membro"}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Convites</h2>
        <InviteForm
          canManage={isOwner}
          pendingInvites={pendingInvites.map((invite) => ({
            id: invite.id,
            email: invite.email,
            expiresAtLabel: invite.expiresAt.toLocaleDateString("pt-BR"),
          }))}
        />
      </section>

      <section className="space-y-4">
        <h2 className="font-medium">Contas</h2>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada.</p>
        ) : (
          <ul className="space-y-4">
            {accounts.map((account) => (
              <li key={account.id} className="space-y-3 rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium">{account.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {FINANCIAL_ACCOUNT_TYPE_LABELS[account.type as FinancialAccountType] ??
                        account.type}
                      {account.institutionName ? ` · ${account.institutionName}` : ""}
                    </p>
                    <p className="mt-1 text-sm">
                      {formatBRL(account.openingBalanceCents)}
                      {account.active ? "" : " · desativada"}
                    </p>
                  </div>
                  {isOwner && account.active ? (
                    <DeactivateAccountButton accountId={account.id} />
                  ) : null}
                </div>
                {isOwner ? (
                  <AccountForm
                    accountId={account.id}
                    defaultDate={account.openingBalanceDate}
                    defaultValues={{
                      name: account.name,
                      institutionName: account.institutionName ?? "",
                      type: account.type as FinancialAccountType,
                      openingBalance: formatCentsInput(account.openingBalanceCents),
                      openingBalanceDate: account.openingBalanceDate,
                    }}
                    submitLabel="Salvar alterações"
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {isOwner ? (
          <div className="rounded-2xl border border-dashed border-border p-4">
            <h3 className="font-medium">Nova conta</h3>
            <div className="mt-4">
              <AccountForm defaultDate={todayInSaoPaulo()} submitLabel="Adicionar conta" />
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <h2 className="font-medium">Categorias</h2>
        <ul className="space-y-2">
          {categoryRows.map((category) => (
            <li key={category.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3">
              <div>
                <p className="font-medium">{category.name}</p>
                <p className="text-sm text-muted-foreground">
                  {category.type === "INCOME" ? "Receita" : "Despesa"} · {category.kind}
                  {category.active ? "" : " · desativada"}
                </p>
              </div>
              {category.active ? <DeactivateCategoryButton categoryId={category.id} /> : null}
            </li>
          ))}
        </ul>
        <CategoryForm />
      </section>
    </div>
  );
}
