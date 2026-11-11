"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ClientTab } from "@/domain/clients";
import { cn } from "@/lib/utils";

export function ClientTabsNav({ base, tabs }: { base: string; tabs: ClientTab[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Seções do cliente" className="border-b px-2 sm:px-4">
      <ul className="flex gap-1 overflow-x-auto">
        {tabs.map((t) => {
          const href = t.key ? `${base}/${t.key}` : base;
          const active = t.key ? pathname.startsWith(href) : pathname === base;
          return (
            <li key={t.key || "geral"} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px flex min-h-11 items-center border-b-2 px-3 text-sm whitespace-nowrap",
                  active ? "border-brand font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
