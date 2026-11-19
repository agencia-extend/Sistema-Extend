"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/anuncios", label: "Visão geral" },
  { href: "/anuncios/clientes", label: "Clientes" },
  { href: "/anuncios/campanhas", label: "Campanhas" },
  { href: "/anuncios/conjuntos", label: "Conjuntos" },
  { href: "/anuncios/anuncios", label: "Anúncios" },
  { href: "/anuncios/alertas", label: "Alertas" },
  { href: "/anuncios/planos", label: "Planos" },
  { href: "/anuncios/nomenclatura", label: "Nomenclatura" },
];

// Filtros que acompanham a troca de aba.
const KEEP = ["periodo", "de", "ate", "cliente", "conta", "status"];

/** Abas do módulo Anúncios (como no HubSystem): os filtros seguem de uma aba para a outra. */
export function AdsTabs() {
  const pathname = usePathname();
  const params = useSearchParams();
  const q = new URLSearchParams();
  for (const k of KEEP) if (params.get(k)) q.set(k, params.get(k)!);
  const query = q.toString();
  return (
    <nav aria-label="Seções de anúncios" className="-mx-1 flex gap-1 overflow-x-auto border-b px-1 [scrollbar-width:none]">
      {TABS.map((t) => {
        const active = t.href === "/anuncios" ? pathname === t.href : pathname.startsWith(t.href);
        const href = query && t.href !== "/anuncios/alertas" ? `${t.href}?${query}` : t.href;
        return (
          <Link key={t.href} href={href} aria-current={active ? "page" : undefined}
            className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap", active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
