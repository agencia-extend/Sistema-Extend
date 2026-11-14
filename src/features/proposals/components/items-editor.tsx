"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RECURRENCES, RECURRENCE_LABEL, type Recurrence } from "@/domain/proposals";
import { centsToInput, formatBRL, parseBRL } from "@/domain/shared/money";
import type { Offer } from "@/features/proposals/queries";

export type ItemDraft = { key: string; serviceId: string | null; name: string; description: string; price: string; discount: string; quantity: string; recurrence: Recurrence };

export const itemFromOffer = (o: Offer): ItemDraft => ({
  key: `${o.serviceId}-${Math.random().toString(36).slice(2, 7)}`,
  serviceId: o.serviceId,
  name: o.name,
  description: o.description,
  price: centsToInput(o.priceCents),
  discount: "",
  quantity: "1",
  recurrence: o.recurrence,
});

export function draftToItem(d: ItemDraft) {
  return {
    serviceId: d.serviceId,
    name: d.name,
    description: d.description,
    priceCents: parseBRL(d.price) ?? -1,
    discountCents: parseBRL(d.discount) ?? (d.discount.trim() ? -1 : 0),
    quantity: Number.parseInt(d.quantity, 10) || 0,
    recurrence: d.recurrence,
  };
}

/** Serviços da proposta: do catálogo (preço padrão) ou avulsos; valor, desconto e quantidade editáveis. */
export function ItemsEditor({ items, offers, errors, onChange }: { items: ItemDraft[]; offers: Offer[]; errors: Record<string, string>; onChange: (items: ItemDraft[]) => void }) {
  const used = new Set(items.map((i) => i.serviceId));
  const available = offers.filter((o) => o.isActive && !used.has(o.serviceId));
  const set = (key: string, patch: Partial<ItemDraft>) => onChange(items.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  return (
    <fieldset className="grid gap-3">
      <legend className="mb-1 text-sm font-semibold">Serviços e valores</legend>
      {errors.items && <p role="alert" className="text-sm text-danger">{errors.items}</p>}
      {items.length === 0 && <p className="rounded-lg border border-dashed bg-surface p-3 text-sm text-muted-foreground">Adicione os serviços que entram nesta proposta.</p>}
      <ol className="grid gap-3">
        {items.map((it, idx) => {
          const line = draftToItem(it);
          const total = line.priceCents >= 0 && line.discountCents >= 0 ? line.priceCents * line.quantity - line.discountCents : null;
          const err = (f: string) => errors[`items.${idx}.${f}`];
          return (
            <li key={it.key} className="grid gap-3 rounded-lg border bg-surface p-3">
              <div className="flex items-start gap-2">
                <label className="grid min-w-0 flex-1 gap-1 text-sm">
                  <span className="font-medium">Serviço {idx + 1}</span>
                  <Input value={it.name} maxLength={120} onChange={(e) => set(it.key, { name: e.target.value })} aria-invalid={Boolean(err("name"))} />
                  {err("name") && <span className="text-xs text-danger">{err("name")}</span>}
                </label>
                <Button type="button" variant="ghost" size="icon" className="mt-6" onClick={() => onChange(items.filter((i) => i.key !== it.key))} aria-label={`Remover ${it.name || "serviço"}`}>
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Descrição na proposta</span>
                <Textarea rows={2} maxLength={1000} value={it.description} onChange={(e) => set(it.key, { description: e.target.value })} />
              </label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Valor (R$)</span>
                  <Input inputMode="decimal" value={it.price} placeholder="Ex.: 1.500,00…" autoComplete="off" onChange={(e) => set(it.key, { price: e.target.value })} aria-invalid={Boolean(err("priceCents"))} className="tabular" />
                  {err("priceCents") && <span className="text-xs text-danger">{err("priceCents")}</span>}
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Qtd.</span>
                  <Input inputMode="numeric" value={it.quantity} onChange={(e) => set(it.key, { quantity: e.target.value.replace(/\D/g, "").slice(0, 3) })} aria-invalid={Boolean(err("quantity"))} className="tabular" />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Desconto (R$)</span>
                  <Input inputMode="decimal" value={it.discount} placeholder="Ex.: 200,00…" autoComplete="off" onChange={(e) => set(it.key, { discount: e.target.value })} aria-invalid={Boolean(err("discountCents"))} className="tabular" />
                  {err("discountCents") && <span className="text-xs text-danger">{err("discountCents")}</span>}
                </label>
                <div className="grid gap-1 text-sm">
                  <span className="font-medium" id={`rec-${it.key}`}>Cobrança</span>
                  <Select value={it.recurrence} onValueChange={(v) => set(it.key, { recurrence: v as Recurrence })}>
                    <SelectTrigger className="w-full" aria-labelledby={`rec-${it.key}`}><SelectValue /></SelectTrigger>
                    <SelectContent>{RECURRENCES.map((r) => <SelectItem key={r} value={r}>{RECURRENCE_LABEL[r]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-right text-sm tabular">Total do item: <strong>{total != null && total >= 0 ? formatBRL(total) : "—"}</strong></p>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-2">
        {available.length > 0 && (
          <Select value="" onValueChange={(id) => { const o = offers.find((x) => x.serviceId === id); if (o) onChange([...items, itemFromOffer(o)]); }}>
            <SelectTrigger className="w-full sm:w-72" aria-label="Adicionar serviço do catálogo"><SelectValue placeholder="Adicionar serviço do catálogo" /></SelectTrigger>
            <SelectContent>
              {available.map((o) => <SelectItem key={o.serviceId} value={o.serviceId}>{o.name}{o.priceCents != null ? ` · ${formatBRL(o.priceCents)}` : ""}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Button type="button" variant="outline" onClick={() => onChange([...items, { key: Math.random().toString(36).slice(2, 9), serviceId: null, name: "", description: "", price: "", discount: "", quantity: "1", recurrence: "mensal" }])}>
          <Plus aria-hidden="true" /> Serviço avulso
        </Button>
      </div>
    </fieldset>
  );
}
