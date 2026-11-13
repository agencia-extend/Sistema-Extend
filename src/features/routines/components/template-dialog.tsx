"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { PRIORITY_LABEL, TASK_TYPE_LABEL } from "@/domain/tasks";
import { REPEAT_OPTIONS, TEMPLATE_CATEGORY_LABEL, repeatFromKey, repeatKey } from "@/domain/tasks/repeat";
import { saveTemplate } from "@/features/routines/actions";
import type { TemplateInput } from "@/features/routines/schemas";
import { handleResult } from "@/lib/action-feedback";

const TYPES = ["video", "design", "conteudo", "gravacao", "site", "geral"] as const;

/** Criar/editar um modelo de demanda. */
export function TemplateDialog({ template, trigger }: { template?: TemplateInput; trigger: ReactNode }) {
  const router = useRouter();
  const blank: TemplateInput = { name: "", category: "outros", type: "geral", description: "", dueDays: 3, priority: "media", repeat: null, isActive: true };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<TemplateInput>(template ?? blank);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setError(null);
      setErrors({});
      const res = await saveTemplate(v);
      if (!res.ok) {
        setError(res.message);
        setErrors(res.fieldErrors ?? {});
        return;
      }
      handleResult(res);
      setOpen(false);
      router.refresh();
    });

  const pick = (label: string, value: string, items: [string, string][], set: (x: string) => void) => (
    <Select value={value} onValueChange={set}>
      <SelectTrigger className="w-full" aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>{items.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
    </Select>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setV(template ?? blank); setError(null); setErrors({}); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template?.id ? "Editar modelo" : "Novo modelo"}</DialogTitle>
          <DialogDescription>Aparece em “Começar de um modelo” ao criar uma demanda.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormAlert>{error}</FormAlert>
          <FormField label="Nome" required error={errors.name?.[0]}>
            <Input autoComplete="off" placeholder="Ex.: Criativos para feed…" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Categoria">{pick("Categoria", v.category, Object.entries(TEMPLATE_CATEGORY_LABEL), (x) => setV({ ...v, category: x as TemplateInput["category"] }))}</FormField>
            <FormField label="Tipo de demanda">{pick("Tipo de demanda", v.type, TYPES.map((t) => [t, TASK_TYPE_LABEL[t]]), (x) => setV({ ...v, type: x as TemplateInput["type"] }))}</FormField>
            <FormField label="Prazo (dias depois de criar)" error={errors.dueDays?.[0]}>
              <Input type="number" inputMode="numeric" min={0} max={365} value={v.dueDays} onChange={(e) => setV({ ...v, dueDays: Number(e.target.value) })} />
            </FormField>
            <FormField label="Prioridade">{pick("Prioridade", v.priority, Object.entries(PRIORITY_LABEL), (x) => setV({ ...v, priority: x as TemplateInput["priority"] }))}</FormField>
            <FormField label="Repetir">
              {pick("Repetir", repeatKey(v.repeat?.unit, v.repeat?.every), REPEAT_OPTIONS.map((o) => [o.key, o.label]), (x) => setV({ ...v, repeat: repeatFromKey(x) }))}
            </FormField>
            <div className="flex items-center gap-2 self-end pb-2">
              <Switch id="template-active" checked={v.isActive} onCheckedChange={(c) => setV({ ...v, isActive: c })} />
              <label htmlFor="template-active" className="text-sm">Modelo ativo</label>
            </div>
          </div>
          <FormField label="Descrição / briefing" optional error={errors.description?.[0]}>
            <Textarea rows={4} value={v.description ?? ""} onChange={(e) => setV({ ...v, description: e.target.value })} />
          </FormField>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending || v.name.trim().length < 2}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Salvar modelo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
