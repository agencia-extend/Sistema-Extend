"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LEAD_QUALITIES, LEAD_QUALITY_LABEL, type LeadQuality } from "@/domain/ads/client-leads";
import { rateClientLead } from "@/features/ads/leads/actions";
import { handleResult } from "@/lib/action-feedback";

const NONE = "__sem";

/** Avaliação do lead pela equipe (quando o cliente conta por telefone, por exemplo). */
export function LeadRating({ id, clientId, quality, label }: { id: string; clientId: string; quality: LeadQuality | null; label: string }) {
  const router = useRouter();
  const [pending, run] = useTransition();
  return (
    <Select
      value={quality ?? NONE}
      disabled={pending}
      onValueChange={(v) =>
        run(async () => {
          const res = await rateClientLead({ id, clientId, quality: v === NONE ? null : v, note: "" });
          if (handleResult(res)) router.refresh();
        })
      }
    >
      <SelectTrigger size="sm" className="w-36" aria-label={`Avaliação de ${label}`}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Sem avaliação</SelectItem>
        {LEAD_QUALITIES.map((q) => <SelectItem key={q} value={q}>{LEAD_QUALITY_LABEL[q]}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
