import { requireSession } from "@/lib/require-session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireSession();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="border-b border-border bg-card/80">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center px-4 sm:px-6">
          <p className="font-heading text-sm tracking-tight">Financeiro Familiar</p>
        </div>
      </div>
      {children}
    </div>
  );
}
