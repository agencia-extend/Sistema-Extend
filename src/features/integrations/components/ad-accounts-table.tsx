"use client";

import { useState, useTransition } from "react";
import { Lightbulb } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { googleCustomerId, type Provider } from "@/domain/integrations";
import { saveAdAccount } from "@/features/integrations/actions";
import type { AdAccountView } from "@/features/integrations/queries";
import { handleResult } from "@/lib/action-feedback";

const NONE = "__nenhum";
const PROVIDER: Record<Provider, string> = { meta: "Meta", google: "Google Ads" };
const shownId = (a: AdAccountView) => (a.provider === "google" ? googleCustomerId(a.externalId) : a.externalId);

/** Contas encontradas: escolher o cliente e se a conta entra no sistema (tabela no computador, cartões no celular). */
export function AdAccountsTable({ accounts, clients }: { accounts: AdAccountView[]; clients: { id: string; name: string }[] }) {
  const [filter, setFilter] = useState<"todas" | Provider>("todas");
  const shown = accounts.filter((a) => filter === "todas" || a.provider === filter);
  const enabled = accounts.filter((a) => a.isEnabled).length;
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {accounts.length} {accounts.length === 1 ? "conta encontrada" : "contas encontradas"} · {enabled} {enabled === 1 ? "entra" : "entram"} no sistema
        </p>
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-40" aria-label="Plataforma"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="meta">Meta</SelectItem>
            <SelectItem value="google">Google Ads</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="hidden grid-cols-[minmax(0,1.6fr)_7rem_8rem_minmax(0,1.3fr)_7rem] gap-4 border-b px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
          <span>Conta</span>
          <span>Plataforma</span>
          <span>Situação</span>
          <span>Cliente</span>
          <span className="text-right">Entra no sistema</span>
        </div>
        <ul className="divide-y">
          {shown.map((a) => <Row key={a.id} a={a} clients={clients} />)}
        </ul>
      </div>
    </div>
  );
}

function Row({ a, clients }: { a: AdAccountView; clients: { id: string; name: string }[] }) {
  const [pending, run] = useTransition();
  const [clientId, setClientId] = useState<string | null>(a.clientId);
  const save = (enabled: boolean, client: string | null) =>
    run(async () => {
      const res = await saveAdAccount({ id: a.id, enabled, clientId: client });
      if (!handleResult(res)) setClientId(a.clientId);
    });
  const suggested = a.suggestedClientId ? clients.find((c) => c.id === a.suggestedClientId) : null;
  return (
    <li className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1.6fr)_7rem_8rem_minmax(0,1.3fr)_7rem] md:items-center md:gap-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{a.name}</p>
        <p className="truncate text-xs text-muted-foreground tabular">
          {shownId(a)}
          {a.managerName ? ` · ${a.provider === "meta" ? "BM" : "MCC"} ${a.managerName}` : ""}
          {a.viaPersonal ? " · pela conexão pessoal de um gestor" : ""}
        </p>
      </div>
      <span className="text-sm"><span className="text-muted-foreground md:hidden">Plataforma: </span>{PROVIDER[a.provider]}</span>
      <span className="text-sm"><span className="text-muted-foreground md:hidden">Situação: </span>{a.statusLabel ?? "—"}</span>
      <div className="grid gap-1">
        <Select
          value={clientId ?? NONE}
          disabled={pending}
          onValueChange={(v) => {
            const next = v === NONE ? null : v;
            setClientId(next);
            save(next ? a.isEnabled : false, next);
          }}
        >
          <SelectTrigger className="w-full" aria-label={`Cliente da conta ${a.name}`}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Sem cliente</SelectItem>
            {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {suggested && !clientId && (
          <button
            type="button"
            disabled={pending}
            className="inline-flex items-center gap-1 justify-self-start text-left text-xs font-medium text-primary hover:underline"
            onClick={() => {
              setClientId(suggested.id);
              save(a.isEnabled, suggested.id);
            }}
          >
            <Lightbulb className="size-3.5" aria-hidden="true" /> Usar {suggested.name} (já tem esta conta cadastrada)
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 md:justify-end">
        <Switch
          checked={a.isEnabled}
          disabled={pending || !clientId}
          onCheckedChange={(v) => save(v, clientId)}
          aria-label={`Incluir ${a.name} no sistema`}
        />
        <span className="text-sm md:sr-only">{a.isEnabled ? "Entra no sistema" : clientId ? "Fora do sistema" : "Escolha o cliente"}</span>
      </div>
    </li>
  );
}
