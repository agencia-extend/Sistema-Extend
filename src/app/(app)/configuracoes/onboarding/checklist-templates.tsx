"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { MILESTONE_KEYS, MILESTONE_LABEL, type MilestoneKey } from "@/domain/clients/milestones";
import { saveChecklistTemplate } from "@/features/clients/settings-actions";
import { checklistTemplateSchema } from "@/features/clients/schemas";
import { handleResult } from "@/lib/action-feedback";

export type Item = {
  id?: string;
  title: string;
  default_sector_id: string | null;
  due_days: number;
  day_kind: "uteis" | "corridos";
  milestone: MilestoneKey | null;
  guidance: string | null;
  is_active: boolean;
};
const NONE = "__nenhum";
const BLANK: Item = { title: "", default_sector_id: null, due_days: 2, day_kind: "uteis", milestone: null, guidance: null, is_active: true };

const dueLabel = (i: Item) => (i.due_days === 0 ? "imediato" : `${i.due_days} ${i.day_kind === "uteis" ? "dia(s) útil(eis)" : "dia(s)"}`);

export function ChecklistTemplates({ sectors, items }: { sectors: { id: string; name: string }[]; items: Item[] }) {
  const [edit, setEdit] = useState<Item | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const sectorName = new Map(sectors.map((s) => [s.id, s.name]));

  const save = () => {
    if (!edit) return;
    const parsed = checklistTemplateSchema.safeParse(edit);
    if (!parsed.success) return void setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
    setErrors({});
    startTransition(async () => {
      if (handleResult(await saveChecklistTemplate(edit))) setEdit(null);
    });
  };

  return (
    <section aria-labelledby="ckl" className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid gap-1">
          <h2 id="ckl" className="text-base font-semibold">Passos do onboarding</h2>
          <p className="text-sm text-muted-foreground">Criados em todo cliente novo, a partir do fechamento. O responsável sai do setor indicado e é avisado; os marcos agrupam os passos na linha do tempo.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setErrors({}); setEdit(BLANK); }}><Plus aria-hidden="true" /> Novo passo</Button>
      </div>
      <ol className="divide-y rounded-xl border bg-card">
        {items.map((i) => (
          <li key={i.id}>
            <button type="button" onClick={() => { setErrors({}); setEdit(i); }} className="grid w-full gap-0.5 px-4 py-2.5 text-left hover:bg-muted/50">
              <span className={i.is_active ? "text-sm" : "text-sm text-muted-foreground line-through"}>{i.title}</span>
              <span className="text-xs text-muted-foreground">
                {[i.milestone ? MILESTONE_LABEL[i.milestone] : "Sem marco", i.default_sector_id ? sectorName.get(i.default_sector_id) : "Sem setor", dueLabel(i)].join(" · ")}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <Dialog open={Boolean(edit)} onOpenChange={(v) => !v && !pending && setEdit(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Editar passo" : "Novo passo"}</DialogTitle>
            <DialogDescription>Vale para os próximos clientes; os onboardings em andamento não mudam.</DialogDescription>
          </DialogHeader>
          {edit && (
            <div className="grid gap-4">
              <FormAlert>{Object.keys(errors).length ? "Revise os campos destacados." : null}</FormAlert>
              <FormField label="Passo" required error={errors.title}><Input autoComplete="off" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Marco">
                  <Select value={edit.milestone ?? NONE} onValueChange={(v) => setEdit({ ...edit, milestone: v === NONE ? null : (v as MilestoneKey) })}>
                    <SelectTrigger className="w-full" aria-label="Marco"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Sem marco</SelectItem>
                      {MILESTONE_KEYS.map((k) => <SelectItem key={k} value={k}>{MILESTONE_LABEL[k]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Setor responsável">
                  <Select value={edit.default_sector_id ?? NONE} onValueChange={(v) => setEdit({ ...edit, default_sector_id: v === NONE ? null : v })}>
                    <SelectTrigger className="w-full" aria-label="Setor responsável"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Sem setor</SelectItem>
                      {sectors.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Prazo após o fechamento" error={errors.due_days} hint="0 = no mesmo dia (imediato).">
                  <Input type="number" min={0} max={90} inputMode="numeric" value={edit.due_days} onChange={(e) => setEdit({ ...edit, due_days: Number(e.target.value) || 0 })} />
                </FormField>
                <FormField label="Contar em">
                  <Select value={edit.day_kind} onValueChange={(v) => setEdit({ ...edit, day_kind: v as Item["day_kind"] })}>
                    <SelectTrigger className="w-full" aria-label="Contar em"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="uteis">Dias úteis (sem fim de semana e feriados)</SelectItem>
                      <SelectItem value="corridos">Dias corridos</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
              <FormField label="Orientação" optional error={errors.guidance} hint="Aparece embaixo do passo: objetivo, canal, o que levar.">
                <Textarea rows={3} maxLength={1000} value={edit.guidance ?? ""} onChange={(e) => setEdit({ ...edit, guidance: e.target.value })} />
              </FormField>
              <div className="flex min-h-10 items-center gap-3">
                <Switch id="ckl-ativo" checked={edit.is_active} onCheckedChange={(v) => setEdit({ ...edit, is_active: v })} />
                <Label htmlFor="ckl-ativo" className="font-normal">Passo ativo</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button disabled={pending || (edit?.title.trim().length ?? 0) < 2} onClick={save}>
              {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {pending ? "Salvando…" : "Salvar passo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
