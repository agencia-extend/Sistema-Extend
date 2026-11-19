"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { parseBRL } from "@/domain/shared/money";
import { PLAN_OBJECTIVES, PLAN_OBJECTIVE_LABEL, PLAN_PLATFORMS, PLAN_PLATFORM_LABEL } from "@/domain/ads/plans";
import { loadPlanOptions, savePlan } from "@/features/ads/plan-actions";
import type { PlanOptions } from "@/features/ads/plan-queries";
import { planSchema } from "@/features/ads/plan-schemas";
import { handleResult } from "@/lib/action-feedback";
import { CreativePicker } from "./creative-picker";

export type PlanValues = {
  clientId: string; name: string; platform: string; objective: string; budgetType: string; budget: string; audience: string;
  startDate: string; endDate: string; notes: string; libraryIds: string[]; requestIds: string[];
};

/** Criar ou alterar um plano de campanha: o que vai ao ar, com quanto, para quem, quando e com quais criativos. */
export function PlanDialog({ trigger, clients, initial, id, today }: { trigger: ReactNode; clients: { id: string; name: string }[]; initial?: PlanValues; id?: string; today: string }) {
  const blank: PlanValues = {
    clientId: clients.length === 1 ? clients[0].id : "", name: "", platform: "meta", objective: "", budgetType: "diario", budget: "", audience: "",
    startDate: today, endDate: "", notes: "", libraryIds: [], requestIds: [],
  };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<PlanValues>(initial ?? blank);
  const [options, setOptions] = useState<PlanOptions | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [pending, run] = useTransition();
  const [loading, load] = useTransition();
  // Mudar um campo tira o erro dele (o valor do orçamento tem a chave do schema).
  const set = (patch: Partial<PlanValues>) => {
    setV((s) => ({ ...s, ...patch }));
    setErrors((e) => {
      const n = { ...e };
      for (const k of Object.keys(patch)) delete n[k === "budget" ? "budgetCents" : k];
      return n;
    });
  };
  const f = (k: keyof PlanValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set({ [k]: e.target.value });

  // Criativos do cliente escolhido.
  useEffect(() => {
    if (!open || !v.clientId) return;
    load(async () => {
      const res = await loadPlanOptions({ clientId: v.clientId });
      setOptions(res.ok ? res.data : { campaigns: [], library: [], requests: [] });
    });
  }, [open, v.clientId]);

  const save = () => {
    setAlert(null);
    const cents = parseBRL(v.budget);
    const parsed = planSchema.safeParse({ ...v, id, budgetCents: cents ?? Number.NaN, platform: v.platform || undefined, objective: v.objective || undefined, clientId: v.clientId || undefined });
    const e: Record<string, string> = {};
    if (!parsed.success) for (const i of parsed.error.issues) e[i.path.join(".")] ??= i.message;
    if (cents === null && v.budget.trim()) e.budgetCents = "Use só números, como 1.500,00.";
    if (!parsed.success || Object.keys(e).length) {
      setErrors(e);
      setAlert("Revise os campos destacados.");
      return;
    }
    setErrors({});
    run(async () => {
      const res = await savePlan(parsed.data);
      if (!res.ok) {
        setAlert(res.message);
        if (res.fieldErrors) setErrors(Object.fromEntries(Object.entries(res.fieldErrors).map(([k, m]) => [k, m[0]])));
        return;
      }
      handleResult(res);
      setOpen(false);
    });
  };

  const sameName = options?.campaigns.find((c) => c.platform === v.platform && c.name.trim().toLowerCase() === v.name.trim().toLowerCase());

  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setV(initial ?? blank); setErrors({}); setAlert(null); setOptions(null); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{id ? "Alterar plano de campanha" : "Novo plano de campanha"}</DialogTitle>
          <DialogDescription>Quando a campanha com este nome aparecer na conta do cliente, o plano se liga a ela sozinho e mostra o que já foi gasto.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormAlert>{alert}</FormAlert>
          {!id && clients.length > 1 && (
            <FormField label="Cliente" required error={errors.clientId}>
              <Select value={v.clientId} onValueChange={(x) => set({ clientId: x, libraryIds: [], requestIds: [] })}>
                <SelectTrigger className="w-full" aria-label="Cliente"><SelectValue placeholder="Escolha…" /></SelectTrigger>
                <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Plataforma" required error={errors.platform}>
              <Select value={v.platform} onValueChange={(x) => set({ platform: x })}>
                <SelectTrigger className="w-full" aria-label="Plataforma"><SelectValue placeholder="Escolha…" /></SelectTrigger>
                <SelectContent>{PLAN_PLATFORMS.map((p) => <SelectItem key={p} value={p}>{PLAN_PLATFORM_LABEL[p]}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            <FormField label="Objetivo" required error={errors.objective}>
              <Select value={v.objective} onValueChange={(x) => set({ objective: x })}>
                <SelectTrigger className="w-full" aria-label="Objetivo"><SelectValue placeholder="Escolha…" /></SelectTrigger>
                <SelectContent>{PLAN_OBJECTIVES.map((o) => <SelectItem key={o} value={o}>{PLAN_OBJECTIVE_LABEL[o]}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
          </div>
          <FormField
            label="Nome da campanha"
            required
            error={errors.name}
            hint={sameName ? `Já existe na conta: o plano vai se ligar a “${sameName.name}”.` : "Use o nome padrão (Anúncios › Nomenclatura › Gerar nome). É por ele que o plano se liga à campanha."}
          >
            <Input autoComplete="off" spellCheck={false} maxLength={200} placeholder="Ex.: GWP_LEADS_FRIO_2026-12…" value={v.name} onChange={f("name")} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <FormField label="Orçamento" required error={errors.budgetType}>
              <Select value={v.budgetType} onValueChange={(x) => set({ budgetType: x })}>
                <SelectTrigger className="w-full" aria-label="Tipo de orçamento"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="diario">Por dia</SelectItem>
                  <SelectItem value="total">Total do período</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label={v.budgetType === "total" ? "Valor total (R$)" : "Valor por dia (R$)"} required error={errors.budgetCents}>
              <Input inputMode="decimal" autoComplete="off" placeholder="Ex.: 30,00…" value={v.budget} onChange={f("budget")} />
            </FormField>
            <FormField label="Início" required error={errors.startDate}>
              <Input type="date" value={v.startDate} onChange={f("startDate")} />
            </FormField>
            <FormField label="Fim" optional={v.budgetType === "diario"} required={v.budgetType === "total"} error={errors.endDate} hint={v.budgetType === "diario" ? "Sem fim: segue até encerrar." : undefined}>
              <Input type="date" min={v.startDate || undefined} value={v.endDate} onChange={f("endDate")} />
            </FormField>
          </div>
          <FormField label="Público" required error={errors.audience}>
            <Textarea rows={2} maxLength={1000} placeholder="Ex.: mulheres de 25 a 45 anos em Florianópolis, interesse em estética…" value={v.audience} onChange={f("audience")} />
          </FormField>
          <CreativePicker
            loading={loading || (Boolean(v.clientId) && !options)}
            hasClient={Boolean(v.clientId)}
            options={options}
            libraryIds={v.libraryIds}
            requestIds={v.requestIds}
            onChange={(libraryIds, requestIds) => setV((s) => ({ ...s, libraryIds, requestIds }))}
          />
          <FormField label="Observações" optional error={errors.notes}>
            <Textarea rows={2} maxLength={2000} value={v.notes} onChange={f("notes")} />
          </FormField>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {id ? "Salvar plano" : "Criar plano"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
