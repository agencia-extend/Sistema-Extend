"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRightLeft, CalendarClock, CircleAlert, Info, ListChecks, LoaderCircle, MessageCircle, NotebookPen, PauseCircle, Phone, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { ACTIVITY_KINDS, ACTIVITY_LABEL, type ActivityKind } from "@/domain/crm";
import { formatDateTime } from "@/domain/shared/dates";
import { addActivity, setActivityDone } from "@/features/crm/actions";
import { activitySchema } from "@/features/crm/schemas";
import type { Activity } from "@/features/crm/queries";
import { handleResult } from "@/lib/action-feedback";
import { cn } from "@/lib/utils";

const ICON = { ligacao: Phone, mensagem: MessageCircle, reuniao: Users, nota: NotebookPen, etapa: ArrowRightLeft, sistema: Info, tarefa: ListChecks } as const;

/** Histórico do lead e próximas ações com lembrete (RF-CRM-01). */
export function ActivityPanel({ leadId, activities, canEdit, now }: { leadId: string; activities: Activity[]; canEdit: boolean; now: number }) {
  const router = useRouter();
  const [kind, setKind] = useState<ActivityKind>("ligacao");
  const [body, setBody] = useState("");
  const [due, setDue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Passo de cadência pausada fica nas próximas ações, sem prazo (guardado até retomar).
  const isPending = (a: Activity) => !a.doneAt && Boolean(a.dueAt || a.heldDueAt);
  const pendingActions = activities.filter(isPending).sort((a, b) => (a.dueAt ?? a.heldDueAt!).localeCompare(b.dueAt ?? b.heldDueAt!));
  const history = activities.filter((a) => !isPending(a));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = activitySchema.safeParse({ leadId, kind, body, dueAt: due ? new Date(due).toISOString() : null });
    if (!parsed.success) return void setError(parsed.error.issues[0]?.message ?? "Revise os campos.");
    setError(null);
    start(async () => {
      const res = await addActivity(parsed.data);
      if (!res.ok) return void setError(res.message);
      handleResult(res);
      setBody("");
      setDue("");
      router.refresh();
    });
  };

  const toggle = (id: string, done: boolean) =>
    start(async () => {
      if (handleResult(await setActivityDone({ id, leadId, done }))) router.refresh();
    });

  return (
    <div className="grid gap-6">
      {canEdit && (
        <form onSubmit={submit} noValidate className="grid gap-3 rounded-xl border bg-card p-4">
          <h2 className="text-base font-semibold">Registrar contato ou agendar próxima ação</h2>
          <FormAlert>{error}</FormAlert>
          <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
            <FormField label="Tipo">
              <Select value={kind} onValueChange={(k) => setKind(k as ActivityKind)}>
                <SelectTrigger className="w-full" aria-label="Tipo"><SelectValue /></SelectTrigger>
                <SelectContent>{ACTIVITY_KINDS.map((k) => <SelectItem key={k} value={k}>{ACTIVITY_LABEL[k]}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            <FormField label="Lembrar em" optional hint="Preencha para virar próxima ação com lembrete.">
              <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
            </FormField>
          </div>
          <FormField label="O que aconteceu ou o que fazer" required>
            <Textarea rows={3} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />
          </FormField>
          <Button type="submit" className="justify-self-start" disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {due ? "Agendar próxima ação" : "Registrar no histórico"}
          </Button>
        </form>
      )}

      <section aria-labelledby="proximas" className="grid gap-2">
        <h2 id="proximas" className="text-base font-semibold">Próximas ações</h2>
        {pendingActions.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-surface px-4 py-4 text-sm text-muted-foreground">
            Nenhuma ação agendada. Todo lead aberto precisa de um próximo passo: agende acima.
          </p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {pendingActions.map((a) => {
              const late = a.dueAt ? new Date(a.dueAt).getTime() < now : false;
              return (
                <li key={a.id} className="flex items-start gap-3 px-4 py-3">
                  <Checkbox id={`a-${a.id}`} className="mt-0.5" checked={false} disabled={!canEdit || pending} onCheckedChange={() => toggle(a.id, true)} aria-label={`Concluir: ${a.body}`} />
                  <label htmlFor={`a-${a.id}`} className="grid min-w-0 gap-0.5 text-sm">
                    <span className="break-words whitespace-pre-wrap">{a.body}</span>
                    {a.autoMessage && <span className="rounded-md border-l-2 border-primary/50 bg-muted/50 px-2 py-1 text-xs break-words whitespace-pre-wrap">Sai sozinha pelo WhatsApp: {a.autoMessage}</span>}
                    {a.sendError && <span className="flex items-start gap-1 text-xs text-danger"><CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> {a.sendError}</span>}
                    {a.dueAt ? (
                      <span className={cn("flex items-center gap-1 text-xs tabular", late ? "font-medium text-danger" : "text-muted-foreground")}>
                        <CalendarClock className="size-3.5" aria-hidden="true" /> {ACTIVITY_LABEL[a.kind]}{a.fromCadence ? " da cadência" : ""} · {formatDateTime(a.dueAt)}{late ? " · atrasada" : ""}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-warning"><PauseCircle className="size-3.5" aria-hidden="true" /> Cadência pausada: era para {formatDateTime(a.heldDueAt!)}</span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="historico" className="grid gap-2">
        <h2 id="historico" className="text-base font-semibold">Histórico</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ainda sem registros.</p>
        ) : (
          <ol className="grid gap-3">
            {history.map((a) => {
              const Icon = ICON[a.kind];
              return (
                <li key={a.id} className="flex gap-3">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border bg-card" aria-hidden="true"><Icon className="size-3.5 text-muted-foreground" /></span>
                  <div className="grid min-w-0 gap-0.5 text-sm">
                    <span className="break-words whitespace-pre-wrap">{a.body}</span>
                    {a.sentAt && <span className="flex items-center gap-1 text-xs text-success"><Send className="size-3" aria-hidden="true" /> Enviada sozinha pelo WhatsApp em {formatDateTime(a.sentAt)}</span>}
                    <span className="text-xs text-muted-foreground">
                      {ACTIVITY_LABEL[a.kind]} · {formatDateTime(a.createdAt)}{a.author ? ` · ${a.author}` : ""}
                      {a.doneAt && a.dueAt ? ` · feita em ${formatDateTime(a.doneAt)}` : ""}
                    </span>
                    {a.doneAt && a.dueAt && canEdit && (
                      <button type="button" className="justify-self-start rounded-sm text-xs text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50" onClick={() => toggle(a.id, false)} disabled={pending}>
                        Reabrir ação
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
