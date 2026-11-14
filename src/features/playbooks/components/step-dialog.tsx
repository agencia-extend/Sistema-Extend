"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { STEP_TASK_TYPES, type StepTaskType } from "@/domain/playbooks";
import { TASK_TYPE_LABEL } from "@/domain/tasks";
import { saveStep } from "@/features/playbooks/actions";
import { stepSchema } from "@/features/playbooks/schemas";
import { handleResult } from "@/lib/action-feedback";

export type StepDraft = { id?: string; title: string; guidance: string; offsetDays: string; dayKind: "uteis" | "corridos"; sectorId: string | null; taskType: StepTaskType; milestone: string };
const NONE = "__nenhum";

/** Etapa do playbook: o que fazer, em quantos dias, por qual setor, e o marco a que pertence. */
export function StepDialog({
  playbookId,
  step,
  sectors,
  milestones,
  trigger,
}: {
  playbookId: string;
  step?: StepDraft;
  sectors: { id: string; name: string }[];
  milestones: string[];
  trigger: ReactNode;
}) {
  const router = useRouter();
  const blank: StepDraft = { title: "", guidance: "", offsetDays: "0", dayKind: "uteis", sectorId: null, taskType: "geral", milestone: milestones.at(-1) ?? "" };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<StepDraft>(step ?? blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () => {
    const parsed = stepSchema.safeParse({ ...v, playbookId, offsetDays: v.offsetDays === "" ? Number.NaN : Number(v.offsetDays) });
    if (!parsed.success) return void setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
    setErrors({});
    start(async () => {
      const res = await saveStep(parsed.data);
      if (!res.ok) return void setError(res.message);
      handleResult(res);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setV(step ?? blank); setErrors({}); setError(null); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{step?.id ? "Editar etapa" : "Nova etapa"}</DialogTitle>
          <DialogDescription>Cada etapa vira uma demanda quando o playbook é aplicado. O prazo conta a partir da data de início.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormAlert>{error}</FormAlert>
          <FormField label="Etapa" required error={errors.title}>
            <Input autoComplete="off" placeholder="Ex.: Configurar o pixel…" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Prazo após o início" required error={errors.offsetDays} hint="0 = no dia do início.">
              <Input type="number" inputMode="numeric" min={0} max={365} value={v.offsetDays} onChange={(e) => setV({ ...v, offsetDays: e.target.value })} />
            </FormField>
            <FormField label="Contar em">
              <Select value={v.dayKind} onValueChange={(k) => setV({ ...v, dayKind: k as StepDraft["dayKind"] })}>
                <SelectTrigger className="w-full" aria-label="Contar em"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="uteis">Dias úteis</SelectItem>
                  <SelectItem value="corridos">Dias corridos</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Setor responsável" hint="A demanda vai para a pessoa deste setor no cliente.">
              <Select value={v.sectorId ?? NONE} onValueChange={(s) => setV({ ...v, sectorId: s === NONE ? null : s })}>
                <SelectTrigger className="w-full" aria-label="Setor responsável"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem setor</SelectItem>
                  {sectors.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Tipo de demanda">
              <Select value={v.taskType} onValueChange={(t) => setV({ ...v, taskType: t as StepTaskType })}>
                <SelectTrigger className="w-full" aria-label="Tipo de demanda"><SelectValue /></SelectTrigger>
                <SelectContent>{STEP_TASK_TYPES.map((t) => <SelectItem key={t} value={t}>{TASK_TYPE_LABEL[t] ?? t}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
          </div>
          <FormField label="Marco" optional error={errors.milestone} hint="Agrupa etapas na linha do tempo. Use o mesmo nome para juntar.">
            <Input autoComplete="off" list={`marcos-${playbookId}`} placeholder="Ex.: Planejamento…" value={v.milestone} onChange={(e) => setV({ ...v, milestone: e.target.value })} />
          </FormField>
          <datalist id={`marcos-${playbookId}`}>{milestones.map((m) => <option key={m} value={m} />)}</datalist>
          <FormField label="Orientação" optional error={errors.guidance} hint="Vai na descrição da demanda: o que fazer, onde, com qual modelo.">
            <Textarea rows={4} maxLength={2000} value={v.guidance} onChange={(e) => setV({ ...v, guidance: e.target.value })} />
          </FormField>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {pending ? "Salvando…" : step?.id ? "Salvar etapa" : "Adicionar etapa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
