import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFoundPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="font-heading text-3xl tracking-tight">Página não encontrada</h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
        Esse endereço não existe neste aplicativo.
      </p>
      <Link href="/login" className={cn(buttonVariants(), "mt-6 h-11 px-4")}>
        Ir para o login
      </Link>
    </div>
  );
}
