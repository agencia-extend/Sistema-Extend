"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, LoaderCircle, Pause, Play, Repeat, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { STEP_KIND_LABEL, cadenceSchedule, dayLabel } from "@/domain/crm/cadence";
import { formatDateTime } from "@/domain/shared/dates";
import { changeCadence, enrollLead, setLeadOptOut } from "@/features/crm/cadence-actions";
import type { CadenceTemplate, LeadCadence } from "@/features/crm/cadence-queries";
import { handleResult } from "@/lib/action-feedback";
import { cn } from "@/lib/utils";

const STATUS = { ativa: "Em andamento", pausada: "Pausada", concluida: "Concluída", cancelada: "Cancelada" } as const;

/** Cadência do lead (RF-CRM-06): iniciar, acompanhar, pausar, retomar, cancelar e "não quer mais contato". */
export function LeadCadenceCard({ leadId, templates, current, optOut, canEdit, today }: {
  leadId: string; templates: CadenceTemplate[]; current: LeadCadence | null; optOut: { at: string; note: string | null } | null; canEdit: boolean; today: string;
}) {
  const router = useRouter();
  const [tpl, setTpl] = useState(templates[0]?.id ?? "");
  const [start, setStart] = useState(today);
  const [note, setNote] = useState("");
  const [pending, run] = useTransition();
  const running = current && (current.status === "ativa" || current.status === "pausada");
  const chosen = templates.find((t) => t.id === tpl);
  const act = (p: Promise<{ ok: boolean; message?: string }>) => run(async () => { if (handleResult((await p) as never)) router.refresh(); });

  return (
    <section aria-labelledby="cadencia" className="grid gap-3 rounded-xl border bg-card p-4">
      <h2 id="cadencia" className="flex items-center gap-1.5 text-sm font-semibold"><Repeat className="size-4 text-primary" aria-hidden="true" /> Cadência</h2>
      {optOut ? (
        <div className="grid gap-2 text-sm">
          <p className="flex items-start gap-1.5 text-danger"><Ban className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> Não quer mais contato desde {formatDateTime(optOut.at)}{optOut.note ? `: ${optOut.note}` : "."}</p>
          {canEdit && <Button variant="ghost" size="sm" className="w-fit" disabled={pending} onClick={() => act(setLeadOptOut({ leadId, out: false, note: "" }))}>Voltou a aceitar contato</Button>}
        </div>
      ) : running ? (
        <div className="grid gap-2 text-sm">
          <p className="font-medium">{current.name}</p>
          <p className={cn("text-xs", current.status === "pausada" ? "text-warning" : "text-muted-foreground")}>
            {STATUS[current.status]}{current.reason ? ` · ${current.reason}` : ""} · {current.done} de {current.total} passos feitos
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Passos feitos" aria-valuenow={current.done} aria-valuemin={0} aria-valuemax={current.total}>
            <div className="h-full bg-primary" style={{ width: `${current.total ? (current.done / current.total) * 100 : 0}%` }} />
          </div>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              {current.status === "ativa"
                ? <Button size="sm" variant="outline" disabled={pending} onClick={() => act(changeCadence({ id: current.id, leadId, action: "pausar" }))}><Pause aria-hidden="true" /> Pausar</Button>
                : <Button size="sm" variant="outline" disabled={pending} onClick={() => act(changeCadence({ id: current.id, leadId, action: "retomar" }))}><Play aria-hidden="true" /> Retomar</Button>}
              <ConfirmDialog trigger={<Button size="sm" variant="ghost" className="text-danger" disabled={pending}><X aria-hidden="true" /> Cancelar</Button>}
                title="Cancelar a cadência?" description="Os passos que faltam saem das próximas ações. O que já foi feito fica no histórico." confirmLabel="Cancelar cadência"
                onConfirm={async () => { if (handleResult(await changeCadence({ id: current.id, leadId, action: "cancelar" }))) router.refresh(); }} />
            </div>
          )}
        </div>
      ) : templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma cadência ativa. Quem configura o funil cria em Configurações › Cadências.</p>
      ) : canEdit ? (
        <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); act(enrollLead({ leadId, templateId: tpl, start })); }}>
          {current && <p className="text-xs text-muted-foreground">Última: {current.name} ({STATUS[current.status].toLowerCase()}).</p>}
          <div className="grid gap-1.5">
            <Label htmlFor="cad-tpl">Cadência</Label>
            <Select value={tpl} onValueChange={setTpl}>
              <SelectTrigger id="cad-tpl" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cad-start">Começa em</Label>
            <Input id="cad-start" type="date" min={today} value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          {chosen && (
            <ol className="grid gap-0.5 text-xs text-muted-foreground" aria-label="Passos da cadência">
              {chosen.steps.map((s, i) => {
                const when = cadenceSchedule(start || today, [s])[0];
                return <li key={i}>{dayLabel(s.day)} · {when.slice(8, 10)}/{when.slice(5, 7)} {s.time} · {STEP_KIND_LABEL[s.kind]}: {s.title}{s.auto ? " (sai sozinha)" : ""}</li>;
              })}
            </ol>
          )}
          <Button type="submit" size="sm" className="w-fit" disabled={pending || !tpl || !start}>{pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Iniciar cadência</Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">{current ? `Última: ${current.name} (${STATUS[current.status].toLowerCase()}).` : "Sem cadência."}</p>
      )}
      {canEdit && !optOut && (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Não quer mais contato?</summary>
          <div className="mt-2 grid gap-2">
            <Label htmlFor="opt-note" className="text-xs">Motivo (opcional)</Label>
            <Input id="opt-note" maxLength={300} autoComplete="off" placeholder="Ex.: pediu para não ligar mais…" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button type="button" size="sm" variant="outline" className="w-fit text-danger" disabled={pending} onClick={() => act(setLeadOptOut({ leadId, out: true, note }))}>
              <Ban aria-hidden="true" /> Marcar: não quer mais contato
            </Button>
          </div>
        </details>
      )}
    </section>
  );
}
