"use client";

import { useState, useTransition, type ReactNode } from "react";
import { ArrowDown, ArrowUp, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { STEP_KINDS, STEP_KIND_LABEL, type CadenceStep, type StepKind } from "@/domain/crm/cadence";
import { saveCadence } from "@/features/crm/cadence-actions";
import { cadenceSchema } from "@/features/crm/schemas";
import type { CadenceTemplate } from "@/features/crm/cadence-queries";
import { handleResult } from "@/lib/action-feedback";

const blank = (): CadenceStep => ({ day: 0, time: "09:00", kind: "mensagem", title: "", message: "", auto: false });

/** Criar ou editar uma cadência: passos com dia, horário, tipo, título e mensagem (com {nome} e {empresa}). */
export function CadenceEditor({ cadence, trigger }: { cadence: CadenceTemplate | null; trigger: ReactNode }) {
  const init = () => ({ name: cadence?.name ?? "", description: cadence?.description ?? "", steps: cadence?.steps.length ? cadence.steps.map((s) => ({ ...s })) : [blank()] });
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(init);
  const [alert, setAlert] = useState<string | null>(null);
  const [pending, run] = useTransition();
  const setStep = (i: number, patch: Partial<CadenceStep>) => setV((x) => ({ ...x, steps: x.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const move = (i: number, d: -1 | 1) => setV((x) => {
    const steps = [...x.steps];
    [steps[i], steps[i + d]] = [steps[i + d], steps[i]];
    return { ...x, steps };
  });

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = cadenceSchema.safeParse({ id: cadence?.id ?? null, ...v });
    if (!parsed.success) {
      const i = parsed.error.issues[0];
      const step = i?.path[0] === "steps" && typeof i.path[1] === "number" ? `Passo ${i.path[1] + 1}: ` : "";
      return setAlert(`${step}${i?.message ?? "Revise os campos."}`);
    }
    setAlert(null);
    run(async () => {
      const res = await saveCadence(parsed.data);
      if (!res.ok) return void setAlert(res.message);
      handleResult(res);
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setV(init()); setAlert(null); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{cadence ? `Editar ${cadence.name}` : "Nova cadência"}</DialogTitle>
          <DialogDescription>Cada passo vira uma próxima ação do lead, no dia e horário marcados. {"{nome}"} vira o primeiro nome e {"{empresa}"} a empresa do lead.</DialogDescription>
        </DialogHeader>
        <form id="cadence-form" onSubmit={save} noValidate className="grid gap-4">
          <FormAlert>{alert}</FormAlert>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Nome" required><Input maxLength={80} autoComplete="off" placeholder="Ex.: Follow-up de proposta…" value={v.name} onChange={(e) => setV((x) => ({ ...x, name: e.target.value }))} /></FormField>
            <FormField label="Para que serve" optional><Input maxLength={300} autoComplete="off" value={v.description} onChange={(e) => setV((x) => ({ ...x, description: e.target.value }))} /></FormField>
          </div>
          <ol className="grid gap-3" aria-label="Passos">
            {v.steps.map((s, i) => (
              <li key={i} className="grid gap-3 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">Passo {i + 1}</span>
                  <span className="flex gap-1">
                    <Button type="button" variant="ghost" size="icon" aria-label={`Subir o passo ${i + 1}`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button>
                    <Button type="button" variant="ghost" size="icon" aria-label={`Descer o passo ${i + 1}`} disabled={i === v.steps.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
                    <Button type="button" variant="ghost" size="icon" className="text-danger" aria-label={`Excluir o passo ${i + 1}`} disabled={v.steps.length === 1} onClick={() => setV((x) => ({ ...x, steps: x.steps.filter((_, j) => j !== i) }))}><Trash2 /></Button>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-[6rem_7rem_10rem_minmax(0,1fr)]">
                  <div className="grid gap-1.5"><Label htmlFor={`d-${i}`}>Dia (D+)</Label><Input id={`d-${i}`} type="number" inputMode="numeric" min={0} max={90} value={s.day} onChange={(e) => setStep(i, { day: Number(e.target.value) })} /></div>
                  <div className="grid gap-1.5"><Label htmlFor={`h-${i}`}>Horário</Label><Input id={`h-${i}`} type="time" value={s.time} onChange={(e) => setStep(i, { time: e.target.value })} /></div>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`k-${i}`}>Tipo</Label>
                    <Select value={s.kind} onValueChange={(k) => setStep(i, { kind: k as StepKind, auto: k === "mensagem" ? s.auto : false })}>
                      <SelectTrigger id={`k-${i}`} className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{STEP_KINDS.map((k) => <SelectItem key={k} value={k}>{STEP_KIND_LABEL[k]}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 grid gap-1.5 sm:col-span-1"><Label htmlFor={`t-${i}`}>O que fazer</Label><Input id={`t-${i}`} maxLength={120} autoComplete="off" placeholder="Ex.: Ligar para tirar dúvidas…" value={s.title} onChange={(e) => setStep(i, { title: e.target.value })} /></div>
                </div>
                {s.kind === "mensagem" && (
                  <div className="grid gap-2">
                    <Label htmlFor={`m-${i}`}>Mensagem</Label>
                    <Textarea id={`m-${i}`} rows={3} maxLength={1000} placeholder="Oi, {nome}! …" value={s.message} onChange={(e) => setStep(i, { message: e.target.value })} />
                    <div className="flex items-center gap-2">
                      <Checkbox id={`a-${i}`} checked={s.auto} onCheckedChange={(c) => setStep(i, { auto: c === true })} />
                      <Label htmlFor={`a-${i}`} className="text-sm font-normal">Enviar sozinha pelo WhatsApp da Extend no horário</Label>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ol>
          <Button type="button" variant="outline" className="w-fit" disabled={v.steps.length >= 15}
            onClick={() => setV((x) => ({ ...x, steps: [...x.steps, { ...blank(), day: (x.steps.at(-1)?.day ?? 0) + 2 }] }))}>
            <Plus aria-hidden="true" /> Adicionar passo
          </Button>
        </form>
        <DialogFooter>
          <Button type="submit" form="cadence-form" disabled={pending}>{pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {cadence ? "Salvar cadência" : "Criar cadência"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
