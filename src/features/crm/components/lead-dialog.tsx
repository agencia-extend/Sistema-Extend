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
import { LEAD_SOURCES, SOURCE_LABEL, type LeadSource } from "@/domain/crm";
import { centsToInput, parseBRL } from "@/domain/shared/money";
import { saveLead } from "@/features/crm/actions";
import { leadSchema } from "@/features/crm/schemas";
import { handleResult } from "@/lib/action-feedback";

export type LeadFormValues = {
  id?: string;
  pipelineId: string;
  stageId: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  source: LeadSource;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  valueCents: number | null;
  ownerId: string | null;
  notes: string;
};

const NONE = "__ninguem";

/** Cadastrar ou editar um lead. Telefone ou e-mail repetido aponta o lead que já existe. */
export function LeadDialog({ initial, people, trigger }: { initial: LeadFormValues; people: { id: string; name: string }[]; trigger: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(initial);
  const [value, setValue] = useState(centsToInput(initial.valueCents));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (patch: Partial<LeadFormValues>) => setV((x) => ({ ...x, ...patch }));

  const save = () => {
    const parsed = leadSchema.safeParse({ ...v, valueCents: parseBRL(value) });
    if (!parsed.success) return void setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
    setErrors({});
    setError(null);
    start(async () => {
      const res = await saveLead(parsed.data);
      if (!res.ok) {
        setError(res.message);
        if (res.fieldErrors) setErrors(Object.fromEntries(Object.entries(res.fieldErrors).map(([k, m]) => [k, m[0]])));
        return;
      }
      handleResult(res);
      setOpen(false);
      if (!initial.id && res.data) router.push(`/comercial/leads/${(res.data as { id: string }).id}`);
      else router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setV(initial); setValue(centsToInput(initial.valueCents)); setErrors({}); setError(null); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{initial.id ? "Editar lead" : "Novo lead"}</DialogTitle>
          <DialogDescription>Telefone ou e-mail é obrigatório. O sistema avisa se o contato já está no comercial.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormAlert>{error}</FormAlert>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Nome do contato" required error={errors.name}>
              <Input autoComplete="off" value={v.name} onChange={(e) => set({ name: e.target.value })} />
            </FormField>
            <FormField label="Empresa" optional error={errors.company}>
              <Input autoComplete="off" value={v.company} onChange={(e) => set({ company: e.target.value })} />
            </FormField>
            <FormField label="WhatsApp / telefone" error={errors.phone}>
              <Input type="tel" inputMode="tel" autoComplete="off" placeholder="(51) 99999-0000…" value={v.phone} onChange={(e) => set({ phone: e.target.value })} />
            </FormField>
            <FormField label="E-mail" error={errors.email}>
              <Input type="email" inputMode="email" autoComplete="off" spellCheck={false} value={v.email} onChange={(e) => set({ email: e.target.value })} />
            </FormField>
            <FormField label="Origem">
              <Select value={v.source} onValueChange={(s) => set({ source: s as LeadSource })}>
                <SelectTrigger className="w-full" aria-label="Origem"><SelectValue /></SelectTrigger>
                <SelectContent>{LEAD_SOURCES.map((s) => <SelectItem key={s} value={s}>{SOURCE_LABEL[s]}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            <FormField label="Valor estimado/mês (R$)" optional error={errors.valueCents}>
              <Input inputMode="decimal" placeholder="0,00…" value={value} onChange={(e) => setValue(e.target.value)} />
            </FormField>
            <FormField label="Responsável" className="sm:col-span-2">
              <Select value={v.ownerId ?? NONE} onValueChange={(o) => set({ ownerId: o === NONE ? null : o })}>
                <SelectTrigger className="w-full" aria-label="Responsável"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{initial.id ? "Ninguém" : "Eu mesmo"}</SelectItem>
                  {people.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <details className="rounded-lg border px-3 py-2 text-sm" open={Boolean(initial.utmCampaign || initial.utmSource)}>
            <summary className="cursor-pointer font-medium">Rastreamento da campanha (UTMs)</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["utmSource", "utm_source"],
                  ["utmMedium", "utm_medium"],
                  ["utmCampaign", "utm_campaign"],
                  ["utmContent", "utm_content"],
                  ["utmTerm", "utm_term"],
                ] as const
              ).map(([k, label]) => (
                <FormField key={k} label={label} optional error={errors[k]}>
                  <Input autoComplete="off" spellCheck={false} value={v[k]} onChange={(e) => set({ [k]: e.target.value })} />
                </FormField>
              ))}
            </div>
          </details>
          <FormField label="Observações" optional error={errors.notes}>
            <Textarea rows={3} maxLength={4000} value={v.notes} onChange={(e) => set({ notes: e.target.value })} />
          </FormField>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {pending ? "Salvando…" : initial.id ? "Salvar lead" : "Cadastrar lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
