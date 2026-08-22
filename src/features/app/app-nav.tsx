import Link from "next/link";

const LINKS = [
  { href: "/dashboard", label: "Início" },
  { href: "/movimentacoes", label: "Movimentações" },
  { href: "/orcamento", label: "Orçamento" },
  { href: "/cartoes", label: "Cartões" },
  { href: "/dividas", label: "Dívidas" },
  { href: "/configuracoes", label: "Configurações" },
] as const;

export function AppNav({ className }: { className?: string }) {
  return (
    <nav className={className}>
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} className="rounded-lg px-2 py-1.5 whitespace-nowrap hover:bg-muted">
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
