"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-page-title">Algo deu errado</h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
        Não foi possível carregar esta página. Tente de novo. Se o problema
        continuar, volte mais tarde.
      </p>
      <Button className="mt-6 h-11" onClick={reset}>
        Tentar novamente
      </Button>
    </div>
  );
}
