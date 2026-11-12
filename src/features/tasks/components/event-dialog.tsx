"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { deleteEvent, saveEvent } from "@/features/tasks/actions";
import { handleResult } from "@/lib/action-feedback";
import { nextFullHourIso } from "@/domain/calendar";

export const EVENT_KIND: Record<string, string> = { gravacao: "Gravação", reuniao: "Reunião", evento: "Evento", bloqueio: "Bloqueio de agenda" };
const NONE = "__nenhum";
const toLocal = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3600_000).toISOString().slice(0, 16);
const fromLocal = (v: string) => new Date(`${v}:00-03:00`).toISOString();

type Ev = {
  id?: string;
  title: string;
  kind: string;
  sectorId?: string | null;
  clientId?: string | null;
  taskId?: string | null;
  startsAt?: string;
  endsAt?: string;
  location?: string;
  link?: string;
  notes?: string;
  attendeeIds?: string[];
};

/** Criar/editar evento da agenda. Participantes recebem notificação (RF-AGE-02). */
export function EventDialog({
  team,
  sectors = [],
  clients = [],
  preset,
  label = "Novo evento",
  trigger,
}: {
  team: { id: string; name: string }[];
  sectors?: { id: string; name: string }[];
  clients?: { id: string; name: string }[];
  preset?: Ev;
  label?: string;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const start = preset?.startsAt ?? nextFullHourIso();
  const end = preset?.endsAt ?? new Date(new Date(start).getTime() + 3_600_000).toISOString();
  const init = { ...preset, title: preset?.title ?? "", kind: preset?.kind ?? "evento", start: toLocal(start), end: toLocal(end), attendeeIds: preset?.attendeeIds ?? [] };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(init);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setError(null);
      const res = await saveEvent({
        id: v.id,
        title: v.title,
        kind: v.kind as "evento",
        sectorId: v.sectorId ?? null,
        clientId: v.clientId ?? null,
        taskId: v.taskId ?? null,
        startsAt: fromLocal(v.start),
        endsAt: fromLocal(v.end),
        location: v.location ?? "",
        link: v.link ?? "",
        notes: v.notes ?? "",
        attendeeIds: v.attendeeIds,
      });
      if (!res.ok) return setError(res.message);
      handleResult(res);
      setOpen(false);
      if (!v.id) setV(init);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <DialogTrigger asChild>{trigger ?? <Button variant={preset?.id ? "ghost" : "outline"} size="sm"><Plus aria-hidden="true" /> {label}</Button>}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{v.id ? "Editar evento" : label}</DialogTitle>
          <DialogDescription>Aparece na agenda dos participantes e na agenda do setor escolhido.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormAlert>{error}</FormAlert>
          <FormField label="Título" required><Input autoComplete="off" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Tipo">
              <Select value={v.kind} onValueChange={(x) => setV({ ...v, kind: x })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(EVENT_KIND).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            {sectors.length > 0 && (
              <FormField label="Agenda do setor" optional>
                <Select value={v.sectorId ?? NONE} onValueChange={(x) => setV({ ...v, sectorId: x === NONE ? null : x })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Nenhum</SelectItem>
                    {sectors.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
            )}
            <FormField label="Início" required><Input type="datetime-local" value={v.start} onChange={(e) => setV({ ...v, start: e.target.value })} /></FormField>
            <FormField label="Fim" required><Input type="datetime-local" value={v.end} onChange={(e) => setV({ ...v, end: e.target.value })} /></FormField>
            {clients.length > 0 && !preset?.clientId && (
              <FormField label="Cliente" optional>
                <Select value={v.clientId ?? NONE} onValueChange={(x) => setV({ ...v, clientId: x === NONE ? null : x })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Nenhum</SelectItem>
                    {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
            )}
            <FormField label="Local" optional><Input autoComplete="off" value={v.location ?? ""} onChange={(e) => setV({ ...v, location: e.target.value })} /></FormField>
          </div>
          <FormField label="Link (Meet, endereço no mapa)" optional><Input type="url" autoComplete="off" value={v.link ?? ""} onChange={(e) => setV({ ...v, link: e.target.value })} /></FormField>
          <FormField label="Observações" optional><Textarea rows={3} value={v.notes ?? ""} onChange={(e) => setV({ ...v, notes: e.target.value })} /></FormField>
          <fieldset className="grid gap-1">
            <legend className="mb-1 text-sm font-medium">Participantes</legend>
            <div className="grid max-h-40 gap-1 overflow-y-auto sm:grid-cols-2">
              {team.map((t) => (
                <div key={t.id} className="flex min-h-9 items-center gap-2">
                  <Checkbox id={`att-${v.id ?? "n"}-${t.id}`} checked={v.attendeeIds.includes(t.id)}
                    onCheckedChange={(c) => setV({ ...v, attendeeIds: c ? [...v.attendeeIds, t.id] : v.attendeeIds.filter((x) => x !== t.id) })} />
                  <Label htmlFor={`att-${v.id ?? "n"}-${t.id}`} className="font-normal">{t.name}</Label>
                </div>
              ))}
            </div>
          </fieldset>
        </div>
        <DialogFooter className="gap-2">
          {v.id && (
            <Button variant="ghost" className="text-danger sm:mr-auto" disabled={pending}
              onClick={() => startTransition(async () => { if (handleResult(await deleteEvent({ id: v.id! }))) { setOpen(false); router.refresh(); } })}>
              <Trash2 aria-hidden="true" /> Excluir
            </Button>
          )}
          <Button onClick={save} disabled={pending || v.title.trim().length < 2}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Salvar evento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
