"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { initials } from "@/domain/inbox";
import { cn } from "@/lib/utils";

/** Foto do contato ou do grupo; sem foto (ou link vencido), as iniciais. */
export function ContactAvatar({ name, url, group = false, className }: { name: string; url: string | null; group?: boolean; className?: string }) {
  const [broken, setBroken] = useState(false);
  const base = cn("grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-sm font-semibold text-accent-foreground", className);
  if (url && !broken) {
    // eslint-disable-next-line @next/next/no-img-element -- foto do WhatsApp (link assinado que expira), sem otimização
    return <img src={url} alt="" width={40} height={40} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className={cn(base, "object-cover")} />;
  }
  return <span aria-hidden="true" className={base}>{group ? <Users className="size-4" /> : initials(name)}</span>;
}
