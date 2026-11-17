"use client";

import { useState, useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveSocialProfile } from "@/features/social/actions";
import type { SocialProfileView } from "@/features/social/queries";
import { handleResult } from "@/lib/action-feedback";

const NONE = "__nenhum";
const int = new Intl.NumberFormat("pt-BR");
export const PLATFORM_LABEL = { facebook: "Página do Facebook", instagram: "Instagram" } as const;

/** Páginas e perfis que a conexão da Meta alcança: escolher de qual cliente é cada um (RF-CON-02). */
export function SocialProfilesTable({ profiles, clients }: { profiles: SocialProfileView[]; clients: { id: string; name: string }[] }) {
  const linked = profiles.filter((p) => p.clientId).length;
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        {profiles.length} {profiles.length === 1 ? "página ou perfil encontrado" : "páginas e perfis encontrados"} · {linked} {linked === 1 ? "ligado" : "ligados"} a cliente
      </p>
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="hidden grid-cols-[minmax(0,1.6fr)_10rem_7rem_minmax(0,1.3fr)] gap-4 border-b px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
          <span>Página ou perfil</span>
          <span>Tipo</span>
          <span className="text-right">Seguidores</span>
          <span>Cliente</span>
        </div>
        <ul className="divide-y" aria-label="Páginas e perfis">
          {profiles.map((p) => <Row key={p.id} p={p} clients={clients} />)}
        </ul>
      </div>
    </div>
  );
}

function Row({ p, clients }: { p: SocialProfileView; clients: { id: string; name: string }[] }) {
  const [pending, run] = useTransition();
  const [clientId, setClientId] = useState<string | null>(p.clientId);
  const label = p.username ? `@${p.username}` : p.name;
  return (
    <li className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1.6fr)_10rem_7rem_minmax(0,1.3fr)] md:items-center md:gap-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground">
          {p.username ? p.name : `ID ${p.externalId}`}{p.viaClient ? " · pelo Facebook do cliente" : ""}
        </p>
        {p.syncError && <p className="text-xs break-words text-danger">{p.syncError}</p>}
      </div>
      <span className="text-sm">{PLATFORM_LABEL[p.platform]}</span>
      <span className="text-sm tabular md:text-right"><span className="text-muted-foreground md:hidden">Seguidores: </span>{p.followers === null ? "—" : int.format(p.followers)}</span>
      <Select
        value={clientId ?? NONE}
        disabled={pending}
        onValueChange={(v) => {
          const next = v === NONE ? null : v;
          setClientId(next);
          run(async () => {
            if (!handleResult(await saveSocialProfile({ id: p.id, clientId: next }))) setClientId(p.clientId);
          });
        }}
      >
        <SelectTrigger className="w-full" aria-label={`Cliente de ${label} (${PLATFORM_LABEL[p.platform]})`}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Sem cliente</SelectItem>
          {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </li>
  );
}
