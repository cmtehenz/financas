import { PageShell, SkeletonBlock } from "@/features/app/ui";

export default function LoadingTransactions() {
  return (
    <PageShell>
      <SkeletonBlock className="h-16" />
      <SkeletonBlock className="h-28" />
      <p className="text-sm text-muted-foreground">Carregando...</p>
    </PageShell>
  );
}
