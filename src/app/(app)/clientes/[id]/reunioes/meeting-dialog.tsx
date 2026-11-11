"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { deleteMeeting, saveMeeting } from "@/features/clients/actions";
import { handleResult } from "@/lib/action-feedback";
import { MEETING_KINDS } from "@/domain/clients";

type Meeting = { id?: string; held_at: string; kind: string; title: string; summary: string; link: string; participant_ids: string[] };

/** datetime-local no fuso de São Paulo a partir de ISO. */
const toLocal = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3600_000).toISOString().slice(0, 16);

export function MeetingDialog({ clientId, team, meeting }: { clientId: string; team: { id: string; name: string }[]; meeting?: Meeting }) {
  const blank: Meeting = { held_at: toLocal(new Date().toISOString()), kind: "briefing", title: "", summary: "", link: "", participant_ids: [] };
  const [open, setOpen] = useState(false);
  const [m, setM] = useState<Meeting>(meeting ? { ...meeting, held_at: toLocal(meeting.held_at) } : blank);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setError(null);
      const res = await saveMeeting({ ...m, kind: m.kind as never, clientId, held_at: new Date(`${m.held_at}:00-03:00`).toISOString() });
      if (!res.ok) return setError(res.message);
      handleResult(res);
      setOpen(false);
      if (!meeting) setM(blank);
    });

  return (
    <Dialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
      <DialogTrigger asChild>
        {meeting ? (
          <Button variant="ghost" size="sm" aria-label="Editar reunião"><Pencil aria-hidden="true" /> Editar</Button>
        ) : (
          <Button><Plus aria-hidden="true" /> Nova reunião</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{meeting ? "Editar reunião" : "Nova reunião"}</DialogTitle>
          <DialogDescription>Data no futuro = reunião agendada. Os participantes recebem aviso.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormAlert>{error}</FormAlert>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Data e hora" required>
              <Input type="datetime-local" value={m.held_at} onChange={(e) => setM({ ...m, held_at: e.target.value })} />
            </FormField>
            <FormField label="Tipo" required>
              <Select value={m.kind} onValueChange={(v) => setM({ ...m, kind: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(MEETING_KINDS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
          </div>
          <FormField label="Título" required>
            <Input autoComplete="off" placeholder="Ex.: Briefing inicial…" value={m.title} onChange={(e) => setM({ ...m, title: e.target.value })} />
          </FormField>
          <FormField label="Resumo e tópicos" optional>
            <Textarea rows={5} value={m.summary} onChange={(e) => setM({ ...m, summary: e.target.value })} />
          </FormField>
          <FormField label="Link da gravação, Meet ou ata" optional>
            <Input type="url" autoComplete="off" placeholder="https://…" value={m.link} onChange={(e) => setM({ ...m, link: e.target.value })} />
          </FormField>
          <fieldset className="grid gap-1">
            <legend className="mb-1 text-sm font-medium">Participantes da equipe</legend>
            <div className="grid max-h-40 gap-1 overflow-y-auto sm:grid-cols-2">
              {team.map((t) => (
                <div key={t.id} className="flex min-h-9 items-center gap-2">
                  <Checkbox
                    id={`part-${meeting?.id ?? "n"}-${t.id}`}
                    checked={m.participant_ids.includes(t.id)}
                    onCheckedChange={(v) => setM({ ...m, participant_ids: v ? [...m.participant_ids, t.id] : m.participant_ids.filter((x) => x !== t.id) })}
                  />
                  <Label htmlFor={`part-${meeting?.id ?? "n"}-${t.id}`} className="font-normal">{t.name}</Label>
                </div>
              ))}
            </div>
          </fieldset>
        </div>
        <DialogFooter className="gap-2">
          {meeting?.id && (
            <Button
              variant="ghost"
              className="text-danger sm:mr-auto"
              disabled={pending}
              onClick={() => startTransition(async () => { if (handleResult(await deleteMeeting({ id: meeting.id!, clientId }))) setOpen(false); })}
            >
              <Trash2 aria-hidden="true" /> Excluir
            </Button>
          )}
          <Button onClick={save} disabled={pending || m.title.trim().length < 2 || !m.held_at}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Salvar reunião
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
