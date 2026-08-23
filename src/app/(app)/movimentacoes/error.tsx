"use client";

import { Button } from "@/components/ui/button";
import { PageShell } from "@/features/app/ui";

export default function TransactionsError({ reset }: { reset: () => void }) {
  return (
    <PageShell className="items-center justify-center text-center">
      <h1 className="text-page-title">Não foi possível carregar as movimentações</h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        Tente novamente. Se o problema continuar, volte ao início.
      </p>
      <Button className="mt-6 h-11" onClick={reset}>
        Tentar novamente
      </Button>
    </PageShell>
  );
}
