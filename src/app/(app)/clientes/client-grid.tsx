"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { AlertTriangle, Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, NoResults } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { deliveredPercent, journeyStage, STATUS_LABEL, type ClientStatus } from "@/domain/clients";
import type { ClientCard } from "@/features/clients/queries";
import { Avatars, ClientStatusBadge, ProgressBar } from "@/features/clients/components/bits";
import { cn } from "@/lib/utils";
import { daysAgoMs } from "@/domain/shared/dates";

const ALL = "__todos";
const STATUSES: (ClientStatus | "todos")[] = ["todos", "ativo", "onboarding", "pausado", "encerrado"];
const PERIODS: Record<string, string> = { "7": "Entraram nos últimos 7 dias", "30": "Últimos 30 dias", "90": "Últimos 90 dias" };

export function ClientGrid({
  clients,
  services,
  people,
  canCreate,
}: {
  clients: ClientCard[];
  services: { id: string; name: string }[];
  people: { id: string; name: string }[];
  canCreate: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const status = sp.get("status") ?? "todos";
  const q = sp.get("q") ?? "";
  const service = sp.get("servico") ?? "";
  const person = sp.get("responsavel") ?? "";
  const period = sp.get("periodo") ?? "";

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
    const since = period ? daysAgoMs(Number(period)) : 0;
    return clients.filter(
      (c) =>
        (status === "todos" || c.status === status) &&
        (!term || c.name.toLowerCase().includes(term) || c.segment?.toLowerCase().includes(term)) &&
        (!service || c.services.some((s) => s.name === service)) &&
        (!person || c.members.some((m) => m.id === person)) &&
        (!since || new Date(c.created_at).getTime() >= since),
    );
  }, [clients, status, q, service, person, period]);

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

      <div className="flex flex-wrap gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            defaultValue={q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder="Buscar cliente ou nicho…"
            aria-label="Buscar cliente"
            className="pl-9"
            autoComplete="off"
          />
        </div>
        <Select value={service || ALL} onValueChange={(v) => set({ servico: v })}>
          <SelectTrigger className="w-full sm:w-52" aria-label="Filtrar por serviço">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os serviços</SelectItem>
            {services.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={person || ALL} onValueChange={(v) => set({ responsavel: v })}>
          <SelectTrigger className="w-full sm:w-52" aria-label="Filtrar por responsável">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os responsáveis</SelectItem>
            {people.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={period || ALL} onValueChange={(v) => set({ periodo: v })}>
          <SelectTrigger className="w-full sm:w-56" aria-label="Período de entrada">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Qualquer data de entrada</SelectItem>
            {Object.entries(PERIODS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <NoResults
          query={q}
          onClear={
            <Button variant="outline" onClick={() => router.replace(pathname)}>
              Limpar filtros
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 min-[1800px]:grid-cols-4">
          {filtered.map((c) => (
            <li key={c.id}>
              <ClientCardView c={c} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ClientCardView({ c }: { c: ClientCard }) {
  const onboarding = c.status === "onboarding";
  const pct = onboarding ? deliveredPercent(c.onboardingDone, c.onboardingTotal) : deliveredPercent(c.monthDone, c.monthTotal);
  return (
    <Link href={`/clientes/${c.id}`} className="grid h-full gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-brand/50">
      <div className="flex items-start justify-between gap-2">
        <div className="grid min-w-0 gap-0.5">
          <h2 className="truncate text-base font-semibold">{c.name}</h2>
          <p className="truncate text-xs text-muted-foreground">{[c.segment, journeyStage(c.status, c.onboardingDone, c.onboardingTotal)].filter(Boolean).join(" · ")}</p>
        </div>
        <ClientStatusBadge status={c.status} />
      </div>
      <p className="line-clamp-2 min-h-8 text-xs text-muted-foreground">
        {c.services.map((s) => (s.qty ? `${s.name} (${s.qty})` : s.name)).join(" · ") || "Sem serviços vigentes"}
      </p>
      <ProgressBar
        value={pct}
        label={onboarding ? "Checklist de onboarding" : c.monthTotal ? `Entregue no mês (${c.monthDone}/${c.monthTotal})` : "Entregue no mês"}
        tone={onboarding ? "warning" : "info"}
      />
      <div className="flex items-center justify-between gap-2">
        <Avatars people={c.members} />
        {c.overdue > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-danger">
            <AlertTriangle className="size-3.5" aria-hidden="true" /> {c.overdue} atrasada{c.overdue > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </Link>
  );
}
