"use client";

import { useTransition } from "react";
import { LoaderCircle, RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { refreshGroups, saveGroup, sendTestMessage } from "@/features/whatsapp/actions";
import { handleResult } from "@/lib/action-feedback";

export type GroupView = { id: string; name: string; clientId: string | null; isAlerts: boolean; isReports: boolean };
const NONE = "__nenhum";

/** Grupos do número: de qual cliente é cada grupo, qual recebe os alertas internos e qual recebe os relatórios. */
export function GroupsTable({ groups, clients, connected }: { groups: GroupView[]; clients: { id: string; name: string }[]; connected: boolean }) {
  const [pending, run] = useTransition();
  const save = (g: GroupView, patch: Partial<GroupView>) => run(async () => void handleResult(await saveGroup({ id: g.id, clientId: patch.clientId !== undefined ? patch.clientId : g.clientId, alerts: patch.isAlerts ?? g.isAlerts, reports: patch.isReports ?? g.isReports })));

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{groups.length} {groups.length === 1 ? "grupo" : "grupos"} · {groups.filter((g) => g.clientId).length} ligados a clientes</p>
        <Button size="sm" variant="outline" disabled={pending || !connected} onClick={() => run(async () => void handleResult(await refreshGroups({})))}>
          {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />} Buscar grupos
        </Button>
      </div>
      {groups.length === 0 ? (
        <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          {connected ? "Toque em “Buscar grupos” para trazer os grupos de que o número participa." : "Conecte o número para buscar os grupos."}
        </p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card" aria-label="Grupos do WhatsApp">
          {groups.map((g) => (
            <li key={g.id} className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_14rem_auto_auto_auto] md:items-center">
              <span className="min-w-0 text-sm font-medium break-words">{g.name || "Grupo sem nome"}</span>
              <Select value={g.clientId ?? NONE} onValueChange={(v) => save(g, { clientId: v === NONE ? null : v })} disabled={pending}>
                <SelectTrigger className="w-full" aria-label={`Cliente do grupo ${g.name}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem cliente</SelectItem>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                <Switch checked={g.isAlerts} disabled={pending} onCheckedChange={(v) => save(g, { isAlerts: v })} aria-label={`Usar ${g.name} como grupo de alertas internos`} />
                Alertas internos
              </label>
              <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                <Switch checked={g.isReports} disabled={pending} onCheckedChange={(v) => save(g, { isReports: v })} aria-label={`Usar ${g.name} como grupo de relatórios`} />
                Relatórios
              </label>
              <Button size="sm" variant="ghost" disabled={pending || !connected} onClick={() => run(async () => void handleResult(await sendTestMessage({ groupId: g.id })))} aria-label={`Enviar teste para ${g.name}`}>
                <Send aria-hidden="true" /> Teste
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
