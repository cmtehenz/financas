import type { ReactNode } from "react";

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background lg:flex-row">
      <aside className="flex flex-col justify-between border-b border-border bg-card px-6 py-8 lg:w-[40%] lg:border-r lg:border-b-0 lg:px-12 lg:py-16">
        <p className="font-heading text-lg tracking-tight">Financeiro Familiar</p>
        <div className="mt-10 max-w-md lg:mt-0">
          <p className="font-heading text-3xl leading-tight text-foreground sm:text-4xl">
            O dinheiro da casa, com clareza.
          </p>
          <p className="mt-4 text-sm leading-6 text-muted-foreground sm:text-base">
            Controle receitas, gastos, cartões e metas em um só lugar. Feito para
            Gustavo e sua esposa começarem simples e crescerem com segurança.
          </p>
        </div>
        <p className="mt-10 hidden text-xs text-muted-foreground lg:block">
          Valores em Real brasileiro. Dados sempre isolados por Casa.
        </p>
      </aside>
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:px-8 lg:items-center">
        <div className="surface w-full max-w-md p-6 sm:p-8">
          <h1 className="text-page-title">{title}</h1>
          <p className="text-page-subtitle mt-2">{description}</p>
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
