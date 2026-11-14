"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { saveRecording } from "@/features/schedule/actions";
import { recordingSchema } from "@/features/schedule/schemas";
import { handleResult } from "@/lib/action-feedback";

export type RecordingDraft = { id?: string; recordedOn: string; location: string; rawUrl: string; notes: string; people: string[]; tasks: string[] };

type Option = { id: string; name: string };

/** Registrar a diária de gravação: quem gravou, onde, link dos brutos e quais conteúdos foram gravados. */
export function RecordingDialog({
  clientId,
  initial,
  team,
  contents,
  trigger,
  title,
}: {
  clientId: string;
  initial: RecordingDraft;
  team: Option[];
  contents: { id: string; title: string }[];
  trigger: ReactNode;
  title: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toggle = (k: "people" | "tasks", id: string, on: boolean) => setV({ ...v, [k]: on ? [...v[k], id] : v[k].filter((x) => x !== id) });

  const save = () => {
    setError(null);
    const parsed = recordingSchema.safeParse({ ...v, clientId });
    if (!parsed.success) return void setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
    setErrors({});
    start(async () => {
      const res = await saveRecording(parsed.data);
      if (!res.ok) return void setError(res.message);
      handleResult(res);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setV(initial); setErrors({}); setError(null); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Os conteúdos marcados recebem a data, quem gravou e o link dos brutos. Quem edita é avisado.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormAlert>{error}</FormAlert>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Data da gravação" required error={errors.recordedOn}>
              <Input type="date" value={v.recordedOn} onChange={(e) => setV({ ...v, recordedOn: e.target.value })} />
            </FormField>
            <FormField label="Local" optional error={errors.location}>
              <Input autoComplete="off" placeholder="Ex.: clínica, estúdio…" value={v.location} onChange={(e) => setV({ ...v, location: e.target.value })} />
            </FormField>
          </div>
          <FormField label="Link dos takes brutos" optional error={errors.rawUrl} hint="Pasta do Drive de brutos.">
            <Input type="url" inputMode="url" spellCheck={false} autoComplete="off" placeholder="https://drive.google.com/…" value={v.rawUrl} onChange={(e) => setV({ ...v, rawUrl: e.target.value })} />
          </FormField>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Quem gravou <span className="text-danger">*</span></legend>
            <div className="grid max-h-40 gap-1 overflow-y-auto rounded-lg border p-2 sm:grid-cols-2">
              {team.map((p) => (
                <label key={p.id} className="flex min-h-9 items-center gap-2 rounded-md px-2 text-sm hover:bg-muted">
                  <Checkbox checked={v.people.includes(p.id)} onCheckedChange={(c) => toggle("people", p.id, c === true)} />
                  {p.name}
                </label>
              ))}
            </div>
            {errors.people && <p className="text-sm text-danger">{errors.people}</p>}
          </fieldset>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Conteúdos gravados</legend>
            {contents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum conteúdo de vídeo em aberto para este cliente.</p>
            ) : (
              <div className="grid max-h-48 gap-1 overflow-y-auto rounded-lg border p-2">
                {contents.map((c) => (
                  <label key={c.id} className="flex min-h-9 items-center gap-2 rounded-md px-2 text-sm hover:bg-muted">
                    <Checkbox checked={v.tasks.includes(c.id)} onCheckedChange={(on) => toggle("tasks", c.id, on === true)} />
                    <span className="min-w-0 break-words">{c.title}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          <FormField label="Observações" optional error={errors.notes}>
            <Textarea rows={2} maxLength={2000} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
          </FormField>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {pending ? "Salvando…" : "Salvar gravação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
