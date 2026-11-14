"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LEAD_SOURCES, SOURCE_LABEL } from "@/domain/crm";

const ALL = "__todos";

/** Busca e filtros da lista de leads, guardados na URL (dá para mandar o link filtrado). */
export function LeadFilters({ stages, people }: { stages: { id: string; name: string }[]; people: { id: string; name: string }[] }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const spQ = sp.get("q") ?? "";
  const [prevQ, setPrevQ] = useState(spQ);
  if (prevQ !== spQ) {
    setPrevQ(spQ);
    setQ(spQ);
  }

  const push = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) {
      if (!v || v === ALL) next.delete(k);
      else next.set(k, v);
    }
    router.replace(`${path}?${next}`);
  };

  useEffect(() => {
    if (q === spQ) return;
    const t = setTimeout(() => push({ q: q.trim() || null }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const any = ["q", "etapa", "origem", "resp"].some((k) => sp.get(k));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-72">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input type="search" className="pl-9" placeholder="Nome, empresa, telefone ou e-mail…" aria-label="Buscar leads" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" spellCheck={false} />
      </div>
      <Select value={sp.get("etapa") ?? ALL} onValueChange={(v) => push({ etapa: v })}>
        <SelectTrigger className="w-full sm:w-52" aria-label="Etapa"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas as etapas</SelectItem>
          {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={sp.get("origem") ?? ALL} onValueChange={(v) => push({ origem: v })}>
        <SelectTrigger className="w-full sm:w-44" aria-label="Origem"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas as origens</SelectItem>
          {LEAD_SOURCES.map((s) => <SelectItem key={s} value={s}>{SOURCE_LABEL[s]}</SelectItem>)}
        </SelectContent>
      </Select>
      {people.length > 1 && (
        <Select value={sp.get("resp") ?? ALL} onValueChange={(v) => push({ resp: v })}>
          <SelectTrigger className="w-full sm:w-48" aria-label="Responsável"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os responsáveis</SelectItem>
            {people.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      {any && <Button variant="ghost" onClick={() => { setQ(""); push({ q: null, etapa: null, origem: null, resp: null }); }}>Limpar filtros</Button>}
    </div>
  );
}
