"use client";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/app/form-field";
import { CREATIVE_FORMATS, CREATIVE_FORMAT_LABEL, CREATIVE_OBJECTIVES, CREATIVE_OBJECTIVE_LABEL } from "@/domain/creatives";

export type BriefValues = { format: string; objective: string; quantity: string; angle: string; audience: string; cta: string; priority: string; notes: string };
export const BLANK_BRIEF: BriefValues = { format: "", objective: "", quantity: "1", angle: "", audience: "", cta: "", priority: "media", notes: "" };

const PRIORITIES: [string, string][] = [["baixa", "Baixa"], ["media", "Média"], ["alta", "Alta"], ["urgente", "Urgente"]];

/** Campos do briefing do criativo agendado (os mesmos do pedido de criativo). */
export function BriefFields({ v, set, errors, disabled }: { v: BriefValues; set: (v: BriefValues) => void; errors: Record<string, string>; disabled?: boolean }) {
  const f = (k: keyof BriefValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set({ ...v, [k]: e.target.value });
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Formato" required error={errors["brief.format"]}>
          <Select value={v.format} onValueChange={(x) => set({ ...v, format: x })} disabled={disabled}>
            <SelectTrigger className="w-full" aria-label="Formato"><SelectValue placeholder="Escolha…" /></SelectTrigger>
            <SelectContent>{CREATIVE_FORMATS.map((k) => <SelectItem key={k} value={k}>{CREATIVE_FORMAT_LABEL[k]}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <FormField label="Objetivo" required error={errors["brief.objective"]}>
          <Select value={v.objective} onValueChange={(x) => set({ ...v, objective: x })} disabled={disabled}>
            <SelectTrigger className="w-full" aria-label="Objetivo"><SelectValue placeholder="Escolha…" /></SelectTrigger>
            <SelectContent>{CREATIVE_OBJECTIVES.map((k) => <SelectItem key={k} value={k}>{CREATIVE_OBJECTIVE_LABEL[k]}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <FormField label="Quantidade" required error={errors["brief.quantity"]}>
          <Input type="number" inputMode="numeric" min={1} max={50} value={v.quantity} onChange={f("quantity")} disabled={disabled} />
        </FormField>
      </div>
      <FormField label="Ângulo ou mensagem" required error={errors["brief.angle"]}>
        <Input autoComplete="off" placeholder="Ex.: Até 50% off só neste fim de semana…" value={v.angle} onChange={f("angle")} disabled={disabled} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Público" required error={errors["brief.audience"]}>
          <Input autoComplete="off" placeholder="Ex.: Clientes que já compraram…" value={v.audience} onChange={f("audience")} disabled={disabled} />
        </FormField>
        <FormField label="Chamada (CTA)" required error={errors["brief.cta"]}>
          <Input autoComplete="off" placeholder="Ex.: Garanta o seu…" value={v.cta} onChange={f("cta")} disabled={disabled} />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
        <FormField label="Prioridade" required error={errors["brief.priority"]}>
          <Select value={v.priority} onValueChange={(x) => set({ ...v, priority: x })} disabled={disabled}>
            <SelectTrigger className="w-full" aria-label="Prioridade"><SelectValue /></SelectTrigger>
            <SelectContent>{PRIORITIES.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <FormField label="Orientações para quem produz" optional error={errors["brief.notes"]}>
          <Textarea rows={2} value={v.notes} onChange={f("notes")} disabled={disabled} />
        </FormField>
      </div>
    </div>
  );
}
