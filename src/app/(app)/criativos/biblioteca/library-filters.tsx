"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CREATIVE_FORMATS, CREATIVE_FORMAT_LABEL } from "@/domain/creatives";

const ALL = "__todos";

export function LibraryFilters({ clients, statuses }: { clients: { id: string; name: string }[]; statuses: [string, string][] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(sp.toString());
    if (v && v !== ALL) next.set(k, v);
    else next.delete(k);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };
  const selects: [string, string, string, [string, string][]][] = [
    ["cliente", "Filtrar por cliente", "Todos os clientes", clients.map((c) => [c.id, c.name])],
    ["situacao", "Filtrar por situação", "Qualquer situação", statuses],
    ["formato", "Filtrar por formato", "Todos os formatos", CREATIVE_FORMATS.map((f) => [f, CREATIVE_FORMAT_LABEL[f]])],
  ];
  return (
    <div className="grid gap-2 sm:flex sm:flex-wrap">
      <div className="relative sm:w-64">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input defaultValue={sp.get("q") ?? ""} onChange={(e) => set("q", e.target.value)} placeholder="Buscar ângulo, campanha ou copy…" aria-label="Buscar na biblioteca" className="pl-9" autoComplete="off" />
      </div>
      {selects.map(([k, label, all, opts]) => (
        <Select key={k} value={sp.get(k) ?? ALL} onValueChange={(v) => set(k, v)}>
          <SelectTrigger className="w-full sm:w-48" aria-label={label}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{all}</SelectItem>
            {opts.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      ))}
    </div>
  );
}
