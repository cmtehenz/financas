"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  CalendarRange,
  CreditCard,
  Home,
  Landmark,
  PieChart,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export const APP_LINKS = [
  { href: "/dashboard", label: "Início", icon: Home },
  { href: "/planejamento", label: "Planejamento", icon: CalendarRange },
  { href: "/movimentacoes", label: "Movimentações", icon: ArrowLeftRight },
  { href: "/orcamento", label: "Orçamento", icon: PieChart },
  { href: "/cartoes", label: "Cartões", icon: CreditCard },
  { href: "/dividas", label: "Dívidas", icon: Landmark },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

export type AppNavLink = { href: string; label: string; icon?: LucideIcon };

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav({
  className,
  links = APP_LINKS,
  variant = "sidebar",
}: {
  className?: string;
  links?: readonly AppNavLink[];
  variant?: "sidebar" | "bottom" | "menu";
}) {
  const pathname = usePathname();

  return (
    <nav className={className} aria-label="Navegação principal">
      {links.map((link) => {
        const Icon = link.icon;
        const active = isActivePath(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm whitespace-nowrap transition-colors",
              variant === "bottom" && "min-h-11 min-w-16 flex-col justify-center gap-1 px-2 text-[11px]",
              variant === "menu" && "min-h-11",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {Icon ? <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" /> : null}
            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
