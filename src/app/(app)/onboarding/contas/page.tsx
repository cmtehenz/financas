import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { FINANCIAL_ACCOUNT_TYPE_LABELS, type FinancialAccountType } from "@/domain/account-types";
import { AccountForm } from "@/features/onboarding/account-form";
import { OnboardingStepper } from "@/features/onboarding/stepper";
import { todayInSaoPaulo } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { getPendingOnboardingPath } from "@/lib/onboarding-state";
import { requireOnboardingHousehold } from "@/lib/require-household";
import { cn } from "@/lib/utils";
import { listHouseholdAccounts } from "@/services/accounts";

export const metadata: Metadata = {
  title: "Contas da Casa",
};

export default async function OnboardingAccountsPage() {
  const { active, onboarding } = await requireOnboardingHousehold();
  const pending = getPendingOnboardingPath(onboarding);

  if (!active) {
    redirect("/onboarding");
  }

  if (pending === "/dashboard") {
    redirect("/dashboard");
  }

  const accounts = await listHouseholdAccounts(active.household.id);

  return (
    <>
      <OnboardingStepper current="/onboarding/contas" />
      <h1 className="text-page-title">Contas e saldos</h1>
      <p className="text-page-subtitle mt-2 max-w-lg">
        Cadastre as contas manuais da Casa. O saldo inicial entra em centavos e será a
        base do número do início até existirem movimentações.
      </p>
      {accounts.length > 0 ? (
        <ul className="space-y-3">
          {accounts.map((account) => (
            <li key={account.id} className="surface px-4 py-3">
              <p className="text-card-title">{account.name}</p>
              <p className="text-sm text-muted-foreground">
                {FINANCIAL_ACCOUNT_TYPE_LABELS[account.type as FinancialAccountType] ?? account.type}
                {account.institutionName ? ` · ${account.institutionName}` : ""}
              </p>
              <p className="mt-1 text-money text-sm">{formatBRL(account.openingBalanceCents)}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhuma conta ainda. Cadastre a primeira.</p>
      )}
      <div className="surface p-5">
        <h2 className="text-section-title">Nova conta</h2>
        <div className="mt-4">
          <AccountForm defaultDate={todayInSaoPaulo()} submitLabel="Adicionar conta" />
        </div>
      </div>
      {accounts.length > 0 ? (
        <Link
          href="/onboarding/convite"
          className={cn(buttonVariants(), "mt-6 h-11 w-full")}
        >
          Continuar
        </Link>
      ) : null}
    </>
  );
}
