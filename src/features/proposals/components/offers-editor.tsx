"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RECURRENCES, RECURRENCE_LABEL, type Recurrence } from "@/domain/proposals";
import { centsToInput, parseBRL } from "@/domain/shared/money";
import { saveOffer } from "@/features/proposals/actions";
import type { Offer } from "@/features/proposals/queries";
import { handleResult } from "@/lib/action-feedback";

function OfferRow({ offer }: { offer: Offer }) {
  const router = useRouter();
  const [description, setDescription] = useState(offer.description);
  const [price, setPrice] = useState(centsToInput(offer.priceCents));
  const [recurrence, setRecurrence] = useState<Recurrence>(offer.recurrence);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = description !== offer.description || price !== centsToInput(offer.priceCents) || recurrence !== offer.recurrence;

  const save = () => {
    const cents = price.trim() ? parseBRL(price) : null;
    if (price.trim() && (cents == null || cents < 0)) return void setError("Valor inválido. Ex.: 1.500,00");
    setError(null);
    start(async () => {
      if (handleResult(await saveOffer({ serviceId: offer.serviceId, description, priceCents: cents, recurrence }))) router.refresh();
    });
  };

  return (
    <li className="grid gap-3 rounded-xl border bg-card p-4">
      <h3 className="text-sm font-semibold">{offer.name}{!offer.isActive && <span className="ml-2 text-xs font-normal text-muted-foreground">(inativo no catálogo)</span>}</h3>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Descrição comercial de {offer.name}</span>
        <Textarea rows={2} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Preço padrão de {offer.name} (R$)</span>
          <Input inputMode="decimal" className="w-40 tabular" placeholder="Ex.: 1.500,00…" autoComplete="off" value={price} onChange={(e) => setPrice(e.target.value)} aria-invalid={Boolean(error)} />
        </label>
        <div className="grid gap-1 text-sm">
          <span className="font-medium" id={`rec-${offer.serviceId}`}>Cobrança</span>
          <Select value={recurrence} onValueChange={(r) => setRecurrence(r as Recurrence)}>
            <SelectTrigger className="w-40" aria-labelledby={`rec-${offer.serviceId}`}><SelectValue /></SelectTrigger>
            <SelectContent>{RECURRENCES.map((r) => <SelectItem key={r} value={r}>{RECURRENCE_LABEL[r]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button variant={dirty ? "default" : "outline"} onClick={save} disabled={pending || !dirty}>
          {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Salvar {offer.name}
        </Button>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </li>
  );
}

/** Catálogo comercial (RF-PRO-02): descrição e preço padrão; na proposta, tudo é editável. */
export function OffersEditor({ offers }: { offers: Offer[] }) {
  return <ul className="grid gap-3">{offers.map((o) => <OfferRow key={o.serviceId} offer={o} />)}</ul>;
}
