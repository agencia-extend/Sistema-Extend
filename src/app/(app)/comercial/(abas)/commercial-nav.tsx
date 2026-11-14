"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export function CommercialNav({ canImport }: { canImport: boolean }) {
  const path = usePathname();
  const funil = useSearchParams().get("funil");
  const q = funil ? `?funil=${funil}` : "";
  const tabs = [
    { href: `/comercial${q}`, label: "Funil", active: path === "/comercial" },
    { href: `/comercial/leads${q}`, label: "Leads", active: path === "/comercial/leads" },
    { href: `/comercial/painel${q}`, label: "Painel", active: path === "/comercial/painel" },
    ...(canImport ? [{ href: `/comercial/importar${q}`, label: "Importar", active: path === "/comercial/importar" }] : []),
  ];
  return (
    <nav aria-label="Seções do comercial" className="border-b px-2 sm:px-4">
      <ul className="flex gap-1 overflow-x-auto">
        {tabs.map((t) => (
          <li key={t.label} className="shrink-0">
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
