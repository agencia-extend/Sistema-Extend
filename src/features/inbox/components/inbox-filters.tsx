"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Tag } from "@/features/inbox/queries";

const ALL = "__todos";

/** Busca (nome, telefone ou última mensagem), responsável e etiqueta. Fica na URL: dá para voltar e compartilhar. */
export function InboxFilters({ agents, tags }: { agents: { id: string; name: string }[]; tags: Tag[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const go = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) if (v) next.set(k, v); else next.delete(k);
    next.delete("conversa");
    start(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };

  useEffect(() => () => clearTimeout(timer.current), []);
  const type = (v: string) => {
    setQ(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => go({ q: v.trim() || null }), 400);
  };

  return (
    <div className="grid gap-2">
      <form role="search" onSubmit={(e) => { e.preventDefault(); clearTimeout(timer.current); go({ q: q.trim() || null }); }} className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input type="search" name="q" value={q} onChange={(e) => type(e.target.value)} placeholder="Buscar nome, telefone ou mensagem…" aria-label="Buscar conversas"
          autoComplete="off" spellCheck={false} className="h-9 pr-8 pl-8" />
        {pending ? <LoaderCircle className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Buscando…" />
          : q ? <button type="button" onClick={() => { setQ(""); go({ q: null }); }} aria-label="Limpar a busca" className="absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"><X className="size-3.5" aria-hidden="true" /></button> : null}
      </form>
      <div className="grid grid-cols-2 gap-2">
        <Select value={params.get("responsavel") ?? ALL} onValueChange={(v) => go({ responsavel: v === ALL ? null : v })}>
          <SelectTrigger size="sm" className="w-full" aria-label="Filtrar por responsável"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Responsáveis</SelectItem>
            <SelectItem value="ninguem">Sem responsável</SelectItem>
            {agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={params.get("etiqueta") ?? ALL} onValueChange={(v) => go({ etiqueta: v === ALL ? null : v })} disabled={!tags.length}>
          <SelectTrigger size="sm" className="w-full" aria-label="Filtrar por etiqueta"><SelectValue placeholder="Sem etiquetas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{tags.length ? "Etiquetas" : "Sem etiquetas"}</SelectItem>
            {tags.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
