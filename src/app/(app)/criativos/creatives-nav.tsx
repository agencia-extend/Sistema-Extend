"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export function CreativesNav({ showMine }: { showMine: boolean }) {
  const path = usePathname();
  const view = useSearchParams().get("visao") ?? "quadro";
  const tabs = [
    { href: "/criativos", label: "Quadro", active: path === "/criativos" && view === "quadro" },
    { href: "/criativos?visao=lista", label: "Lista", active: path === "/criativos" && view === "lista" },
    ...(showMine ? [{ href: "/criativos?visao=meus", label: "Meus pedidos", active: path === "/criativos" && view === "meus" }] : []),
    { href: "/criativos/biblioteca", label: "Biblioteca", active: path.startsWith("/criativos/biblioteca") },
  ];
  return (
    <nav aria-label="Seções de criativos" className="border-b px-2 sm:px-4">
      <ul className="flex gap-1 overflow-x-auto">
        {tabs.map((t) => (
          <li key={t.href} className="shrink-0">
            <Link
              href={t.href}
              aria-current={t.active ? "page" : undefined}
              className={cn("-mb-px flex min-h-11 items-center border-b-2 px-3 text-sm whitespace-nowrap", t.active ? "border-brand font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
