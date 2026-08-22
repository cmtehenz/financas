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
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      <aside className="flex flex-col justify-between bg-primary px-6 py-8 text-primary-foreground lg:w-[42%] lg:px-12 lg:py-16">
        <p className="font-heading text-lg tracking-tight">Financeiro Familiar</p>
        <div className="mt-10 max-w-md lg:mt-0">
          <h1 className="font-heading text-3xl leading-tight sm:text-4xl">
            O dinheiro da casa, com clareza.
          </h1>
          <p className="mt-4 text-sm leading-6 text-primary-foreground/80 sm:text-base">
            Controle receitas, gastos, cartões e metas em um só lugar. Feito para
            Gustavo e sua esposa começarem simples e crescerem com segurança.
          </p>
        </div>
        <p className="mt-10 hidden text-xs text-primary-foreground/60 lg:block">
          Valores em Real brasileiro. Dados sempre isolados por Casa.
        </p>
      </aside>
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:px-8 lg:items-center">
        <div className="w-full max-w-md">
          <h2 className="font-heading text-2xl tracking-tight">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
