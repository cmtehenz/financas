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
      <h1 className="font-heading mt-8 text-3xl tracking-tight">Contas e saldos</h1>
      <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
        Cadastre as contas manuais da Casa. O saldo inicial entra em centavos e será a
        base do número do início até existirem movimentações.
      </p>
      {accounts.length > 0 ? (
        <ul className="mt-8 space-y-3">
          {accounts.map((account) => (
            <li key={account.id} className="rounded-2xl border border-border bg-card px-4 py-3">
              <p className="font-medium">{account.name}</p>
              <p className="text-sm text-muted-foreground">
                {FINANCIAL_ACCOUNT_TYPE_LABELS[account.type as FinancialAccountType] ?? account.type}
                {account.institutionName ? ` · ${account.institutionName}` : ""}
              </p>
              <p className="mt-1 text-sm">{formatBRL(account.openingBalanceCents)}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 text-sm text-muted-foreground">Nenhuma conta ainda. Cadastre a primeira.</p>
      )}
      <div className="mt-8 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-medium">Nova conta</h2>
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
