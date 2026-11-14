"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Eye, LoaderCircle, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { PAYMENT_OPTIONS, addDaysSP, buildDoc, todaySP, type ProposalSnapshot } from "@/domain/proposals";
import { saveProposal } from "@/features/proposals/actions";
import { proposalSchema } from "@/features/proposals/schemas";
import type { Offer, Template } from "@/features/proposals/queries";
import { handleResult } from "@/lib/action-feedback";
import { cn } from "@/lib/utils";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { ItemsEditor, draftToItem, type ItemDraft } from "./items-editor";
import { ProposalDocument } from "./proposal-document";

export type ProposalDraft = {
  id?: string;
  leadId: string;
  number: number | null;
  templateId: string;
  clientName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  items: ItemDraft[];
  paymentTerms: string;
  notes: string;
  validUntil: string;
};

/** Gerar/editar proposta (RF-PRO-03): só o que muda, com prévia ao vivo do documento. */
export function ProposalEditor({ initial, templates, offers, sellerName, images }: { initial: ProposalDraft; templates: Pick<Template, "id" | "name" | "blocks" | "validityDays">[]; offers: Offer[]; sellerName: string; images: Record<string, string> }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [view, setView] = useState<"form" | "preview">("form");
  const [pending, start] = useTransition();
  const set = <K extends keyof ProposalDraft>(k: K, val: ProposalDraft[K]) => setV((p) => ({ ...p, [k]: val }));
  const tpl = templates.find((t) => t.id === v.templateId) ?? templates[0];
  const [saved, setSaved] = useState(false);
  useUnsavedGuard(!saved && v !== initial);

  const doc = useMemo(() => {
    const snap: ProposalSnapshot = {
      number: v.number ?? 0,
      issuedAt: todaySP(),
      templateName: tpl?.name ?? "",
      blocks: tpl?.blocks ?? [],
      clientName: v.clientName || "Nome do cliente",
      contactName: v.contactName,
      contactPhone: null,
      contactEmail: null,
      sellerName,
      items: v.items.map(draftToItem).map((i) => ({ ...i, priceCents: Math.max(0, i.priceCents), discountCents: Math.max(0, i.discountCents), quantity: Math.max(1, i.quantity) })),
      paymentTerms: v.paymentTerms,
      notes: v.notes,
      validUntil: v.validUntil || todaySP(),
    };
    const d = buildDoc(snap);
    return v.number ? d : { ...d, number: "nova" };
  }, [v, tpl, sellerName]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = proposalSchema.safeParse({ ...v, items: v.items.map(draftToItem) });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[i.path.join(".")] ??= i.message;
      setErrors(errs);
      setAlert("Revise os campos destacados.");
      setView("form");
      return;
    }
    setErrors({});
    setAlert(null);
    start(async () => {
      const res = await saveProposal(parsed.data);
      if (!res.ok) {
        setAlert(res.message);
        if (res.fieldErrors) setErrors(Object.fromEntries(Object.entries(res.fieldErrors).map(([k, m]) => [k, m[0]])));
        return;
      }
      handleResult(res);
      setSaved(true);
      router.push(`/comercial/propostas/${res.data.id}`);
    });
  };

  return (
    <div className="grid gap-4">
      <div className="flex gap-1 rounded-lg border bg-surface p-1 lg:hidden" role="group" aria-label="Alternar entre editar e prévia">
        <Button type="button" variant={view === "form" ? "default" : "ghost"} className="flex-1" aria-pressed={view === "form"} onClick={() => setView("form")}><PencilLine aria-hidden="true" /> Editar</Button>
        <Button type="button" variant={view === "preview" ? "default" : "ghost"} className="flex-1" aria-pressed={view === "preview"} onClick={() => setView("preview")}><Eye aria-hidden="true" /> Prévia</Button>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <form onSubmit={submit} noValidate className={cn("grid content-start gap-5", view === "preview" && "hidden lg:grid")}>
          <FormAlert>{alert}</FormAlert>
          <FormField label="Modelo" required>
            <Select value={v.templateId} onValueChange={(id) => setV((p) => ({ ...p, templateId: id, validUntil: p.id ? p.validUntil : addDaysSP(templates.find((t) => t.id === id)?.validityDays ?? 10) }))}>
              <SelectTrigger className="w-full" aria-label="Modelo"><SelectValue /></SelectTrigger>
              <SelectContent>{templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <FormField label="Nome do cliente" required error={errors.clientName} hint="Empresa ou nome que aparece na capa.">
            <Input value={v.clientName} maxLength={160} onChange={(e) => set("clientName", e.target.value)} />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Contato" error={errors.contactName}>
              <Input value={v.contactName} maxLength={120} autoComplete="off" onChange={(e) => set("contactName", e.target.value)} />
            </FormField>
            <FormField label="WhatsApp do contato" error={errors.contactPhone}>
              <Input value={v.contactPhone} inputMode="tel" autoComplete="off" onChange={(e) => set("contactPhone", e.target.value)} />
            </FormField>
          </div>
          <FormField label="E-mail do contato" error={errors.contactEmail}>
            <Input type="email" value={v.contactEmail} autoComplete="off" spellCheck={false} onChange={(e) => set("contactEmail", e.target.value)} />
          </FormField>
          <ItemsEditor items={v.items} offers={offers} errors={errors} onChange={(items) => set("items", items)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Forma de pagamento" error={errors.paymentTerms}>
              <Input value={v.paymentTerms} maxLength={300} list="formas-pagamento" onChange={(e) => set("paymentTerms", e.target.value)} />
            </FormField>
            <FormField label="Válida até" required error={errors.validUntil}>
              <Input type="date" value={v.validUntil} min={todaySP()} onChange={(e) => set("validUntil", e.target.value)} />
            </FormField>
          </div>
          <datalist id="formas-pagamento">{PAYMENT_OPTIONS.map((o) => <option key={o} value={o} />)}</datalist>
          <FormField label="Observações / diagnóstico" optional error={errors.notes} hint="Entra onde o modelo usa {observacoes}. Se ficar vazio, o bloco some.">
            <Textarea rows={4} maxLength={4000} value={v.notes} onChange={(e) => set("notes", e.target.value)} />
          </FormField>
          <Button type="submit" disabled={pending} className="justify-self-start">
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {v.id ? "Salvar nova versão" : "Criar proposta"}
          </Button>
        </form>
        <section aria-label="Prévia da proposta" className={cn("min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:self-start lg:overflow-y-auto", view === "form" && "hidden lg:block")}>
          <ProposalDocument doc={doc} images={images} />
        </section>
      </div>
    </div>
  );
}
