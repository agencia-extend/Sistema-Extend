"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function SettingsNav({ pages }: { pages: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Configurações" className="border-b lg:min-h-[calc(100dvh-4rem)] lg:border-r lg:border-b-0">
      <p className="hidden px-5 pt-6 pb-2 text-sm font-semibold lg:block">Configurações</p>
      <ul className="flex gap-1 overflow-x-auto px-3 py-2 lg:grid lg:gap-0.5 lg:overflow-visible">
        {pages.map((p) => {
          const active = pathname === p.href || pathname.startsWith(`${p.href}/`);
          return (
            <li key={p.href} className="shrink-0">
              <Link
                href={p.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-10 items-center rounded-md px-3 text-sm whitespace-nowrap",
                  active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {p.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
