"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { LEAD_QUALITIES, LEAD_QUALITY_LABEL, type LeadQuality } from "@/domain/ads/client-leads";
import { formatPhone } from "@/domain/crm";
import { rateLeadPublic } from "@/features/ads/leads/actions";
import type { PublicLead } from "@/features/ads/leads/public";
import { cn } from "@/lib/utils";

const dt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const ON: Record<LeadQuality, string> = {
  bom: "border-success bg-success-soft text-success",
  medio: "border-info bg-info-soft text-info",
  ruim: "border-danger bg-danger-soft text-danger",
  nao_atendeu: "border-foreground/40 bg-muted text-foreground",
};
const NAME_KEY = "avaliar-leads:nome";
const noSubscribe = () => () => {};
// Nome lembrado no aparelho (conveniência; sem armazenamento, a pessoa digita de novo).
const readName = () => {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
};

/** Lista de leads com os quatro botões de avaliação e o comentário opcional; salva a cada toque. */
export function LeadReviewList({ token, leads }: { token: string; leads: PublicLead[] }) {
  const stored = useSyncExternalStore(noSubscribe, readName, () => "");
  const [typed, setName] = useState<string | null>(null);
  const name = typed ?? stored;
  const [nameError, setNameError] = useState<string | null>(null);
  const [ratedIds, setRatedIds] = useState(() => new Set(leads.filter((l) => l.quality).map((l) => l.id)));
  const rememberName = (v: string) => {
    setName(v);
    setNameError(null);
    try {
      localStorage.setItem(NAME_KEY, v);
    } catch {
      // ignora
    }
  };
  const mark = (id: string, rated: boolean) =>
    setRatedIds((s) => {
      const n = new Set(s);
      if (rated) n.add(id);
      else n.delete(id);
      return n;
    });

  return (
    <div className="grid gap-4">
      <FormField label="Seu nome" required error={nameError ?? undefined} hint="Fica registrado junto com cada avaliação.">
        <Input autoComplete="name" maxLength={120} value={name} onChange={(e) => rememberName(e.target.value)} />
      </FormField>
      <p className="text-sm text-muted-foreground" aria-live="polite">{ratedIds.size} de {leads.length} avaliados.</p>
      <ul className="grid gap-3" aria-label="Leads">
        {leads.map((l) => (
          <LeadItem key={l.id} token={token} lead={l} name={name} onRated={mark} onNeedName={() => setNameError("Diga seu nome antes de avaliar.")} />
        ))}
      </ul>
    </div>
  );
}

function LeadItem({ token, lead, name, onRated, onNeedName }: {
  token: string; lead: PublicLead; name: string; onRated: (id: string, rated: boolean) => void; onNeedName: () => void;
}) {
  const [quality, setQuality] = useState<LeadQuality | null>(lead.quality);
  const [note, setNote] = useState(lead.note ?? "");
  const [savedNote, setSavedNote] = useState(lead.note ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, run] = useTransition();
  const title = lead.name ?? (lead.phone ? formatPhone(lead.phone) : lead.email) ?? "Lead";

  const save = (q: LeadQuality | null, n: string) => {
    if (name.trim().length < 2) return onNeedName();
    run(async () => {
      const res = await rateLeadPublic({ token, leadId: lead.id, quality: q, note: q ? n : "", name });
      if (res.ok) {
        setQuality(q);
        setSavedNote(q ? n : "");
        if (!q) setNote("");
        onRated(lead.id, Boolean(q));
      }
      setMsg({ ok: res.ok, text: res.ok ? "Salvo." : res.message });
    });
  };

  return (
    <li className="grid gap-3 rounded-xl border bg-card p-4">
      <div className="grid gap-0.5">
        <p className="font-medium break-words">{title}</p>
        <p className="text-xs break-words text-muted-foreground">
          {[dt.format(new Date(lead.leadAt)), lead.name && lead.phone ? formatPhone(lead.phone) : null, lead.name && lead.email ? lead.email : null, lead.campaign].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div role="radiogroup" aria-label={`Como foi o lead ${title}`} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {LEAD_QUALITIES.map((q) => (
          <button
            key={q}
            type="button"
            role="radio"
            aria-checked={quality === q}
            disabled={pending}
            onClick={() => save(quality === q ? null : q, note)}
            className={cn(
              "h-10 touch-manipulation rounded-lg border px-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60",
              quality === q ? ON[q] : "bg-surface hover:bg-muted",
            )}
          >
            {LEAD_QUALITY_LABEL[q]}
          </button>
        ))}
      </div>
      {quality && (
        <div className="grid gap-1.5">
          <label htmlFor={`nota-${lead.id}`} className="text-sm">
            Comentário <span className="text-muted-foreground">(opcional)</span>
          </label>
          <Textarea
            id={`nota-${lead.id}`}
            rows={2}
            maxLength={1000}
            placeholder="Ex.: fechou consulta, só queria preço…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note !== savedNote && save(quality, note)}
          />
        </div>
      )}
      <div className="min-h-5 text-xs" aria-live="polite">
        {pending ? (
          <span className="inline-flex items-center gap-1 text-muted-foreground"><LoaderCircle className="size-3 animate-spin" aria-hidden="true" /> Salvando…</span>
        ) : msg ? (
          msg.ok ? <span className="text-success">{msg.text}</span> : <FormAlert>{msg.text}</FormAlert>
        ) : null}
      </div>
    </li>
  );
}
