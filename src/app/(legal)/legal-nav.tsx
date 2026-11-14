"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const DOCS = [
  ["/privacidade", "Privacidade"],
  ["/termos", "Termos de uso"],
] as const;

export function LegalNav() {
  const path = usePathname();
  return (
    <nav aria-label="Documentos" className="flex gap-1 text-sm">
      {DOCS.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={path === href ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-2 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
            path === href ? "font-medium text-foreground" : "text-muted-foreground",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
