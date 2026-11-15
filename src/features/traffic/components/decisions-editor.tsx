"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/app/form-field";
import { DECISIONS, DECISION_LABEL, DECISION_LEVELS, DECISION_LEVEL_LABEL } from "@/domain/traffic";

export type DecisionDraft = { level: string; target: string; decision: string; why: string };
export const blankDecision = (): DecisionDraft => ({ level: "campanha", target: "", decision: "", why: "" });

/** Decisões da semana: campanha, conjunto ou anúncio → pausar, manter ou escalar, com o motivo. */
export function DecisionsEditor({ value, onChange, errors }: { value: DecisionDraft[]; onChange: (v: DecisionDraft[]) => void; errors: Record<string, string> }) {
  const set = (i: number, patch: Partial<DecisionDraft>) => onChange(value.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-1 text-sm font-medium">Decisões da semana</legend>
      <p className="-mt-1 text-xs text-muted-foreground">O que pausar, manter ou escalar, com o motivo. Fica no histórico do cliente para o relatório.</p>
      {value.map((d, i) => (
        <div key={i} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[8rem_minmax(0,1fr)_8rem_auto] sm:items-start">
          <FormField label="Nível" error={errors[`decisions.${i}.level`]}>
            <Select value={d.level} onValueChange={(x) => set(i, { level: x })}>
              <SelectTrigger className="w-full" aria-label={`Nível da decisão ${i + 1}`}><SelectValue /></SelectTrigger>
              <SelectContent>{DECISION_LEVELS.map((l) => <SelectItem key={l} value={l}>{DECISION_LEVEL_LABEL[l]}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <FormField label="Nome" error={errors[`decisions.${i}.target`]}>
            <Input autoComplete="off" maxLength={200} placeholder="Ex.: [LEAD] Black Friday…" value={d.target} onChange={(e) => set(i, { target: e.target.value })} aria-label={`Nome da campanha, conjunto ou anúncio da decisão ${i + 1}`} />
          </FormField>
          <FormField label="Decisão" error={errors[`decisions.${i}.decision`]}>
            <Select value={d.decision} onValueChange={(x) => set(i, { decision: x })}>
              <SelectTrigger className="w-full" aria-label={`Decisão ${i + 1}`}><SelectValue placeholder="Escolha…" /></SelectTrigger>
              <SelectContent>{DECISIONS.map((x) => <SelectItem key={x} value={x}>{DECISION_LABEL[x]}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <Button type="button" variant="ghost" size="icon" className="text-danger sm:mt-6" aria-label={`Remover a decisão ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>
            <Trash2 />
          </Button>
          <FormField label="Motivo" className="sm:col-span-4" error={errors[`decisions.${i}.why`]}>
            <Input autoComplete="off" maxLength={1000} placeholder="Ex.: CPL 30% abaixo da meta há 7 dias…" value={d.why} onChange={(e) => set(i, { why: e.target.value })} aria-label={`Motivo da decisão ${i + 1}`} />
          </FormField>
        </div>
      ))}
      {value.length < 30 && (
        <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => onChange([...value, blankDecision()])}>
          <Plus aria-hidden="true" /> Adicionar decisão
        </Button>
      )}
    </fieldset>
  );
}
