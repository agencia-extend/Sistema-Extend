"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CREATIVE_FORMATS, CREATIVE_FORMAT_LABEL } from "@/domain/creatives";
import { PRIORITY_LABEL } from "@/domain/tasks";

const ALL = "__todos";

/** Filtros na URL: cliente, formato, pessoa (quem produz ou pediu) e prioridade. */
export function CreativeFilters({ clients, people }: { clients: { id: string; name: string }[]; people: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(sp.toString());
    if (v && v !== ALL) next.set(k, v);
    else next.delete(k);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };
  const filters: [string, string, string, [string, string][]][] = [
    ["cliente", "Filtrar por cliente", "Todos os clientes", clients.map((c) => [c.id, c.name])],
    ["formato", "Filtrar por formato", "Todos os formatos", CREATIVE_FORMATS.map((f) => [f, CREATIVE_FORMAT_LABEL[f]])],
    ["pessoa", "Filtrar por pessoa", "Todas as pessoas", people.map((p) => [p.id, p.name])],
    ["prioridade", "Filtrar por prioridade", "Qualquer prioridade", Object.entries(PRIORITY_LABEL)],
  ];
  return (
    <div className="grid gap-2 sm:flex sm:flex-wrap">
      {filters.map(([k, label, all, opts]) => (
        <Select key={k} value={sp.get(k) ?? ALL} onValueChange={(v) => set(k, v)}>
          <SelectTrigger className="w-full sm:w-52" aria-label={label}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{all}</SelectItem>
            {opts.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      ))}
    </div>
  );
}
