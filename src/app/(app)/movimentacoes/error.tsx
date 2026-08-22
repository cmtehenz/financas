"use client";

import { Button } from "@/components/ui/button";

export default function TransactionsError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="font-heading text-3xl tracking-tight">Não foi possível carregar as movimentações</h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        Tente novamente. Se o problema continuar, volte ao início.
      </p>
      <Button className="mt-6 h-11" onClick={reset}>
        Tentar novamente
      </Button>
    </div>
  );
}
