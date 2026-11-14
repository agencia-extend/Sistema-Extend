"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, NoResults } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL, contractWindow, type ClientStatus } from "@/domain/clients";
import type { ClientCard } from "@/features/clients/queries";
import { todayKey } from "@/domain/media";
import { daysAgoMs } from "@/domain/shared/dates";
import { cn } from "@/lib/utils";
import { ClientTable } from "./client-table";

const ALL = "__todos";
const STATUSES: (ClientStatus | "todos")[] = ["todos", "ativo", "onboarding", "pausado", "encerrado"];
const PERIODS: Record<string, string> = { "7": "Entraram nos últimos 7 dias", "30": "Últimos 30 dias", "90": "Últimos 90 dias" };
const CONTRACT: Record<string, string> = { "30": "Contrato termina em até 30 dias", vencido: "Contrato vencido" };

/** Lista de clientes (planilha "Controle de Clientes"): abas de status, busca e filtros na URL. */
export function ClientGrid({
  clients,
  services,
  owners,
  canCreate,
}: {
  clients: ClientCard[];
  services: { id: string; name: string }[];
  owners: { id: string; name: string }[];
  canCreate: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const status = sp.get("status") ?? "todos";
  const q = sp.get("q") ?? "";
  const service = sp.get("servico") ?? "";
  const owner = sp.get("responsavel") ?? "";
  const period = sp.get("periodo") ?? "";
  const contract = sp.get("contrato") ?? "";
  const today = todayKey(new Date());

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v && v !== ALL && v !== "todos") next.set(k, v);
      else next.delete(k);
    }
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    // Só número (ou #número): busca pelo Nº do cliente.
    const codeTerm = /^#?\d+$/.test(term) ? Number(term.replace("#", "")) : null;
    const since = period ? daysAgoMs(Number(period)) : 0;
    return clients.filter((c) => {
      const w = contractWindow(c.contract_end, today);
      return (
        (status === "todos" || c.status === status) &&
        (!term || (codeTerm !== null ? c.code === codeTerm : c.name.toLowerCase().includes(term) || c.segment?.toLowerCase().includes(term))) &&
        (!service || c.services.some((s) => s.id === service)) &&
        (!owner || (owner === "sem" ? !c.ownerId : c.ownerId === owner)) &&
        (!since || new Date(c.created_at).getTime() >= since) &&
        (!contract || (contract === "vencido" ? w === "vencido" : w === "termina" || w === "termina_logo"))
      );
    });
  }, [clients, status, q, service, owner, period, contract, today]);

  const count = (s: string) => (s === "todos" ? clients.length : clients.filter((c) => c.status === s).length);

  if (!clients.length) {
    return (
      <EmptyState
        icon={Users}
        title="Nenhum cliente por aqui"
        description={
          canCreate
            ? "Registre um fechamento comercial para criar o primeiro cliente, ou importe a planilha “Controle de clientes”."
            : "Você ainda não foi marcado em nenhum cliente. Quando a coordenação marcar você, eles aparecem aqui."
        }
      />
    );
  }

  return (
    <div className="grid gap-4">
      <div role="tablist" aria-label="Status" className="flex gap-1 overflow-x-auto border-b">
        {STATUSES.map((s) => (
          <button
            key={s}
            role="tab"
            type="button"
            aria-selected={status === s}
            onClick={() => set({ status: s })}
            className={cn(
              "-mb-px min-h-10 shrink-0 border-b-2 px-3 text-sm whitespace-nowrap",
              status === s ? "border-brand font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {s === "todos" ? "Todos" : STATUS_LABEL[s]} <span className="tabular text-muted-foreground">({count(s)})</span>
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:flex sm:flex-wrap">
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input defaultValue={q} onChange={(e) => set({ q: e.target.value })} placeholder="Buscar por nome, nicho ou nº…" aria-label="Buscar cliente" className="pl-9" autoComplete="off" />
        </div>
        <Filter label="Filtrar por serviço" value={service} onChange={(v) => set({ servico: v })} all="Todos os serviços" options={services.map((s) => [s.id, s.name])} />
        <Filter label="Filtrar por responsável" value={owner} onChange={(v) => set({ responsavel: v })} all="Todos os responsáveis" options={[...owners.map((p) => [p.id, p.name] as [string, string]), ["sem", "Sem responsável"]]} />
        <Filter label="Filtrar por contrato" value={contract} onChange={(v) => set({ contrato: v })} all="Qualquer contrato" options={Object.entries(CONTRACT)} />
        <Filter label="Período de entrada" value={period} onChange={(v) => set({ periodo: v })} all="Qualquer data de entrada" options={Object.entries(PERIODS)} />
      </div>

      {filtered.length === 0 ? (
        <NoResults query={q} onClear={<Button variant="outline" onClick={() => router.replace(pathname)}>Limpar filtros</Button>} />
      ) : (
        <ClientTable clients={filtered} today={today} />
      )}
    </div>
  );
}

function Filter({ label, value, onChange, all, options }: { label: string; value: string; onChange: (v: string) => void; all: string; options: [string, string][] }) {
  return (
    <Select value={value || ALL} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-56" aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{all}</SelectItem>
        {options.map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
