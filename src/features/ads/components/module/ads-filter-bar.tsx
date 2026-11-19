"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ADS_PRESETS, type AdsFilters } from "@/domain/ads/filters";
import { cn } from "@/lib/utils";

const ALL = "__todos";

/** Período (atalhos e intervalo), cliente, conta, status e agrupamento do gráfico. Tudo na URL. */
export function AdsFilterBar({ filters, clients, accounts, withGroup = false }: {
  filters: AdsFilters;
  clients: { id: string; name: string }[];
  accounts: { id: string; name: string; clientId: string | null }[];
  withGroup?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [custom, setCustom] = useState(filters.preset === "custom");
  const [from, setFrom] = useState(filters.from);
  const [to, setTo] = useState(filters.to);

  const go = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) if (v) q.set(k, v); else q.delete(k);
    router.replace(`${pathname}?${q}`, { scroll: false });
  };
  const chip = (on: boolean) => cn("shrink-0 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors", on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground");
  const visibleAccounts = accounts.filter((a) => !filters.clientId || a.clientId === filters.clientId);
  const selects: { name: string; label: string; value?: string; all: string; options: [string, string][] }[] = [
    ...(clients.length > 1 ? [{ name: "cliente", label: "Cliente", value: filters.clientId, all: "Todos os clientes", options: clients.map((c): [string, string] => [c.id, c.name]) }] : []),
    ...(visibleAccounts.length > 1 ? [{ name: "conta", label: "Conta", value: filters.accountId, all: "Todas as contas", options: visibleAccounts.map((a): [string, string] => [a.id, a.name]) }] : []),
    { name: "status", label: "Status", value: filters.status, all: "Qualquer status", options: [["ativas", "Ativas"], ["pausadas", "Pausadas"]] },
    ...(withGroup ? [{ name: "agrupar", label: "Agrupar por", value: filters.group === "dia" ? undefined : filters.group, all: "Dia", options: [["semana", "Semana"], ["mes", "Mês"]] as [string, string][] }] : []),
  ];

  return (
    <div className="grid gap-3 rounded-xl border bg-surface p-3">
      <div className="flex gap-1 overflow-x-auto [scrollbar-width:none]" role="group" aria-label="Período">
        {ADS_PRESETS.map(([p, label]) => (
          <button key={p} type="button" aria-pressed={filters.preset === p} className={chip(filters.preset === p)}
            onClick={() => { setCustom(false); go({ periodo: p, de: null, ate: null }); }}>
            {label}
          </button>
        ))}
        <button type="button" aria-pressed={custom} aria-expanded={custom} className={cn(chip(filters.preset === "custom"), "inline-flex items-center gap-1.5")} onClick={() => setCustom((c) => !c)}>
          <CalendarRange className="size-4" aria-hidden="true" /> Intervalo
        </button>
      </div>
      {custom && (
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); go({ periodo: "custom", de: from, ate: to }); }}>
          <div className="grid gap-1">
            <Label htmlFor="ads-de" className="text-xs">De</Label>
            <Input id="ads-de" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="ads-ate" className="text-xs">Até</Label>
            <Input id="ads-ate" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" />
          </div>
          <Button type="submit" size="sm" variant="outline" disabled={!from || !to}>Aplicar</Button>
        </form>
      )}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {selects.map((s) => (
          <Select key={s.name} value={s.value ?? ALL} onValueChange={(v) => go({ [s.name]: v === ALL ? null : v, ...(s.name === "cliente" ? { conta: null } : {}) })}>
            <SelectTrigger size="sm" className="w-full sm:w-52" aria-label={s.label}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{s.all}</SelectItem>
              {s.options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        ))}
      </div>
    </div>
  );
}
