"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PORTAL_NAV, activePortalHref } from "@/domain/portal";
import { cn } from "@/lib/utils";

/** Seções da área do cliente: abas roláveis no celular, em linha no computador. */
export function PortalNav({ pending }: { pending: number }) {
  const active = activePortalHref(usePathname());
  return (
    <nav aria-label="Seções da área do cliente" className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <ul className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-2 sm:px-4">
        {PORTAL_NAV.map((i) => (
          <li key={i.href} className="shrink-0">
            <Link
              href={i.href}
              aria-current={active === i.href ? "page" : undefined}
              className={cn(
                "-mb-px flex min-h-12 items-center gap-1.5 border-b-2 px-3 text-sm whitespace-nowrap",
                active === i.href ? "border-brand font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {i.label}
              {i.href === "/portal/aprovacoes" && pending > 0 && (
                <span className="grid min-w-5 place-items-center rounded-full bg-brand px-1.5 text-xs leading-5 font-semibold text-white tabular">
                  {pending}
                  <span className="sr-only"> aguardando</span>
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
