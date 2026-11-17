"use client";

import { useState, useTransition, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormAlert, FormField } from "@/components/app/form-field";
import { GOAL_KINDS, GOAL_KIND_LABEL, type GoalKind } from "@/domain/ads/goals";
import { centsToInput } from "@/domain/shared/money";
import { saveGoal } from "@/features/ads/actions";
import { goalSchema } from "@/features/ads/schemas";
import type { ClientGoal } from "@/features/ads/queries";
import { handleResult } from "@/lib/action-feedback";

type V = { resultKind: GoalKind; resultsTarget: string; spend: string; maxCost: string; minRoas: string; notes: string };

/** Meta do mês: resultado (leads, conversas, compras, cliques), investimento, custo máximo e ROAS mínimo. */
export function GoalDialog({ clientId, month, monthLabel, goal, trigger }: { clientId: string; month: string; monthLabel: string; goal: ClientGoal | null; trigger: ReactNode }) {
  const initial = (): V => ({
    resultKind: goal?.resultKind ?? "leads",
    resultsTarget: goal?.resultsTarget ? String(goal.resultsTarget) : "",
    spend: centsToInput(goal?.spendCents),
    maxCost: centsToInput(goal?.maxCostCents),
    minRoas: goal?.minRoas ? String(goal.minRoas).replace(".", ",") : "",
    notes: goal?.notes ?? "",
  });
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<V>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [pending, run] = useTransition();
  const set = (k: keyof V) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((c) => ({ ...c, [k]: e.target.value }));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);
    const parsed = goalSchema.safeParse({ clientId, month, ...v });
    if (!parsed.success) {
      const out: Record<string, string> = {};
      for (const i of parsed.error.issues) out[String(i.path[0])] ??= i.message;
      setErrors(out);
      return setAlert("Revise os campos destacados.");
    }
    setErrors({});
    run(async () => {
      const res = await saveGoal({ clientId, month, ...v });
      if (!res.ok) return void setAlert(res.message);
      handleResult(res);
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setV(initial()); setErrors({}); setAlert(null); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Meta de {monthLabel}</DialogTitle>
          <DialogDescription>Preencha só o que foi combinado com o cliente. O progresso usa os números das contas ligadas, até ontem.</DialogDescription>
        </DialogHeader>
        <form id="goal-form" onSubmit={save} className="grid gap-4" noValidate>
          <FormAlert>{alert}</FormAlert>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Resultado" required error={errors.resultKind}>
              <Select value={v.resultKind} onValueChange={(x) => setV((c) => ({ ...c, resultKind: x as GoalKind }))}>
                <SelectTrigger className="w-full" aria-label="Resultado"><SelectValue /></SelectTrigger>
                <SelectContent>{GOAL_KINDS.map((k) => <SelectItem key={k} value={k}>{GOAL_KIND_LABEL[k].many}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            <FormField label="Quantidade no mês" optional error={errors.resultsTarget}>
              <Input inputMode="numeric" autoComplete="off" placeholder="Ex.: 120…" value={v.resultsTarget} onChange={set("resultsTarget")} />
            </FormField>
            <FormField label="Investimento no mês (R$)" optional error={errors.spend}>
              <Input inputMode="decimal" autoComplete="off" placeholder="Ex.: 3.000,00…" value={v.spend} onChange={set("spend")} />
            </FormField>
            <FormField label={`Custo máximo por ${GOAL_KIND_LABEL[v.resultKind].one} (R$)`} optional error={errors.maxCost}>
              <Input inputMode="decimal" autoComplete="off" placeholder="Ex.: 25,00…" value={v.maxCost} onChange={set("maxCost")} />
            </FormField>
            <FormField label="ROAS mínimo" optional error={errors.minRoas} hint="Só para vendas (valor das compras ÷ investimento).">
              <Input inputMode="decimal" autoComplete="off" placeholder="Ex.: 3…" value={v.minRoas} onChange={set("minRoas")} />
            </FormField>
          </div>
          <FormField label="Observação" optional error={errors.notes}>
            <Textarea rows={2} maxLength={500} placeholder="Ex.: meta combinada na reunião de 03/11…" value={v.notes} onChange={set("notes")} />
          </FormField>
        </form>
        <DialogFooter>
          <Button type="submit" form="goal-form" disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Salvar meta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
