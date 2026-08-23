import type { Metadata } from "next";

import { FINANCIAL_ACCOUNT_TYPE_LABELS, type FinancialAccountType } from "@/domain/account-types";
import { EmptyState, PageHeader, PageShell, SectionTitle, StatusBadge, Surface } from "@/features/app/ui";
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
    <PageShell width="narrow">
      <PageHeader
        title="Configurações da Casa"
        description={isOwner ? "Você administra esta Casa." : "Você visualiza os dados desta Casa."}
      />

      <Surface>
        <SectionTitle>Dados da Casa</SectionTitle>
        <div className="mt-4 space-y-3">
          {isOwner ? (
            <UpdateHouseholdForm name={household.name} />
          ) : (
            <p>{household.name}</p>
          )}
          <p className="text-sm text-muted-foreground">
            {household.currency} · {household.timezone}
          </p>
        </div>
      </Surface>

      <section className="space-y-3">
        <SectionTitle>Membros</SectionTitle>
        <ul className="space-y-2">
          {members.map((member) => (
            <li key={member.id} className="surface px-4 py-3">
              <p className="font-medium">{member.name}</p>
              <p className="text-sm text-muted-foreground">
                {member.role === "OWNER" ? "Responsável" : "Membro"}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <Surface>
        <SectionTitle>Convites</SectionTitle>
        <div className="mt-4">
          <InviteForm
            canManage={isOwner}
            pendingInvites={pendingInvites.map((invite) => ({
              id: invite.id,
              email: invite.email,
              expiresAtLabel: invite.expiresAt.toLocaleDateString("pt-BR"),
            }))}
          />
        </div>
      </Surface>

      <section className="space-y-4">
        <SectionTitle>Contas</SectionTitle>
        {accounts.length === 0 ? (
          <EmptyState>Nenhuma conta cadastrada.</EmptyState>
        ) : (
          <ul className="space-y-4">
            {accounts.map((account) => (
              <li key={account.id} className="surface space-y-3 p-4">
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
          <Surface className="border-dashed">
            <h3 className="font-medium">Nova conta</h3>
            <div className="mt-4">
              <AccountForm defaultDate={todayInSaoPaulo()} submitLabel="Adicionar conta" />
            </div>
          </Surface>
        ) : null}
      </section>

      <section className="space-y-4">
        <SectionTitle>Categorias</SectionTitle>
        <ul className="space-y-2">
          {categoryRows.map((category) => (
            <li key={category.id} className="surface flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium">{category.name}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <StatusBadge tone={category.type === "INCOME" ? "success" : "danger"}>
                    {category.type === "INCOME" ? "Receita" : "Despesa"}
                  </StatusBadge>
                  <span>
                    {category.kind}
                    {category.active ? "" : " · desativada"}
                  </span>
                </p>
              </div>
              {category.active ? <DeactivateCategoryButton categoryId={category.id} /> : null}
            </li>
          ))}
        </ul>
        <Surface>
          <CategoryForm />
        </Surface>
      </section>
    </PageShell>
  );
}
