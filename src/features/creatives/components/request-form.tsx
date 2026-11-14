"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LoaderCircle, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { CREATIVE_FORMATS, CREATIVE_FORMAT_LABEL, CREATIVE_OBJECTIVES, CREATIVE_OBJECTIVE_LABEL } from "@/domain/creatives";
import { createCreativeRequest } from "@/features/creatives/actions";
import { requestSchema } from "@/features/creatives/schemas";
import { handleResult } from "@/lib/action-feedback";

type V = { campaign: string; objective: string; format: string; quantity: string; variations: string; angle: string; audience: string; cta: string; copySuggestion: string; references: string[]; dueOn: string; priority: string; notes: string };
const BLANK: V = { campaign: "", objective: "", format: "", quantity: "1", variations: "0", angle: "", audience: "", cta: "", copySuggestion: "", references: [""], dueOn: "", priority: "media", notes: "" };

/** Pedido de criativo (RF-CRI-01/02): não envia incompleto; mostra o que falta perto de cada campo. */
export function RequestForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [v, setV] = useState<V>(BLANK);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const f = (k: keyof V) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const input = { ...v, clientId, quantity: Number(v.quantity), variations: Number(v.variations || 0), references: v.references.map((r) => r.trim()).filter(Boolean), objective: v.objective || undefined, format: v.format || undefined };
    const parsed = requestSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      setError("Preencha os campos obrigatórios para enviar.");
      return;
    }
    setErrors({});
    start(async () => {
      const res = await createCreativeRequest(parsed.data);
      if (!res.ok) return void setError(res.message);
      handleResult(res);
      router.push(`/criativos/${(res.data as { id: string }).id}`);
    });
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <FormAlert>{error}</FormAlert>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Campanha" required error={errors.campaign}><Input autoComplete="off" placeholder="Ex.: Lançamento de novembro…" value={v.campaign} onChange={f("campaign")} /></FormField>
        <FormField label="Objetivo" required error={errors.objective}>
          <Select value={v.objective} onValueChange={(o) => setV({ ...v, objective: o })}>
            <SelectTrigger className="w-full" aria-label="Objetivo"><SelectValue placeholder="Escolha…" /></SelectTrigger>
            <SelectContent>{CREATIVE_OBJECTIVES.map((o) => <SelectItem key={o} value={o}>{CREATIVE_OBJECTIVE_LABEL[o]}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <FormField label="Formato" required error={errors.format}>
          <Select value={v.format} onValueChange={(o) => setV({ ...v, format: o })}>
            <SelectTrigger className="w-full" aria-label="Formato"><SelectValue placeholder="Escolha…" /></SelectTrigger>
            <SelectContent>{CREATIVE_FORMATS.map((o) => <SelectItem key={o} value={o}>{CREATIVE_FORMAT_LABEL[o]}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Quantidade" required error={errors.quantity}><Input type="number" inputMode="numeric" min={1} max={50} value={v.quantity} onChange={f("quantity")} /></FormField>
          <FormField label="Variações" optional error={errors.variations}><Input type="number" inputMode="numeric" min={0} max={20} value={v.variations} onChange={f("variations")} /></FormField>
        </div>
      </div>
      <FormField label="Ângulo / mensagem" required error={errors.angle} hint="A ideia central da peça. Ex.: dor do aluguel.">
        <Input autoComplete="off" value={v.angle} onChange={f("angle")} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Público" required error={errors.audience}><Input autoComplete="off" placeholder="Ex.: inquilinos de 25 a 40 anos…" value={v.audience} onChange={f("audience")} /></FormField>
        <FormField label="CTA (chamada)" required error={errors.cta}><Input autoComplete="off" placeholder="Ex.: Chamar no WhatsApp…" value={v.cta} onChange={f("cta")} /></FormField>
      </div>
      <FormField label="Copy sugerida" optional error={errors.copySuggestion}><Textarea rows={3} maxLength={3000} value={v.copySuggestion} onChange={f("copySuggestion")} /></FormField>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Referências <span className="font-normal text-muted-foreground">(links)</span></legend>
        {v.references.map((r, i) => (
          <div key={i} className="flex gap-2">
            <Input type="url" inputMode="url" spellCheck={false} autoComplete="off" aria-label={`Referência ${i + 1}`} placeholder="https://…" value={r}
              onChange={(e) => setV({ ...v, references: v.references.map((x, j) => (j === i ? e.target.value : x)) })} />
            {v.references.length > 1 && <Button type="button" variant="ghost" size="icon" aria-label={`Tirar a referência ${i + 1}`} onClick={() => setV({ ...v, references: v.references.filter((_, j) => j !== i) })}><X /></Button>}
          </div>
        ))}
        {errors.references && <p className="text-sm text-danger">{errors.references}</p>}
        {v.references.length < 10 && <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setV({ ...v, references: [...v.references, ""] })}><Plus aria-hidden="true" /> Outra referência</Button>}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Prazo" required error={errors.dueOn}><Input type="date" value={v.dueOn} onChange={f("dueOn")} /></FormField>
        <FormField label="Prioridade" required error={errors.priority}>
          <Select value={v.priority} onValueChange={(o) => setV({ ...v, priority: o })}>
            <SelectTrigger className="w-full" aria-label="Prioridade"><SelectValue /></SelectTrigger>
            <SelectContent>{[["baixa", "Baixa"], ["media", "Média"], ["alta", "Alta"], ["urgente", "Urgente"]].map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
      </div>
      <FormField label="Observações" optional error={errors.notes}><Textarea rows={3} maxLength={2000} value={v.notes} onChange={f("notes")} /></FormField>
      <div><Button type="submit" disabled={pending}>{pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {pending ? "Enviando…" : "Enviar pedido"}</Button></div>
    </form>
  );
}
