"use client";

import { useState, useTransition } from "react";
import { ImageOff, LoaderCircle, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormAlert } from "@/components/app/form-field";
import { adStatusLabel } from "@/domain/ads";
import { linkCreativeAd, unlinkCreativeAd } from "@/features/creatives/actions";
import type { LinkableAd, LinkedAd } from "@/features/creatives/performance";
import { RequestFromAdLink } from "./request-from-ad";
import { handleResult } from "@/lib/action-feedback";

const dec = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });

/** Anúncios da Meta ligados ao criativo: pelo código no nome ou à mão (RF-BIB-03). */
export function CreativeAdsPanel({ taskId, libraryId, code, linked, linkable, canLink, canRequest = false }: {
  taskId: string; libraryId: string; code: string; linked: LinkedAd[]; linkable: LinkableAd[]; canLink: boolean; canRequest?: boolean;
}) {
  const [adId, setAdId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, run] = useTransition();

  const link = () => {
    setError(null);
    if (!adId) return setError("Escolha o anúncio que usa este criativo.");
    setBusy("link");
    run(async () => {
      const res = await linkCreativeAd({ libraryId, adId, taskId });
      setBusy(null);
      if (!res.ok) return void setError(res.message);
      handleResult(res);
      setAdId("");
    });
  };
  const unlink = (a: LinkedAd) => {
    setError(null);
    setBusy(a.adId);
    run(async () => {
      const res = await unlinkCreativeAd({ libraryId, adId: a.adId, taskId });
      setBusy(null);
      if (!res.ok) return void setError(res.message);
      handleResult(res);
    });
  };

  return (
    <div className="grid gap-3">
      <FormAlert>{error}</FormAlert>
      {linked.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum anúncio ligado. Ponha <strong className="font-medium text-foreground">{code}</strong> no nome do anúncio na Meta e ele se liga na próxima sincronização{canLink ? ", ou escolha o anúncio abaixo" : ""}.
        </p>
      ) : (
        <ul aria-label="Anúncios ligados" className="grid gap-2">
          {linked.map((a) => (
            <li key={a.adId} className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border p-2">
              {a.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- miniatura servida pela Meta (endereço temporário)
                <img src={a.thumbnailUrl} alt="" width={48} height={48} loading="lazy" className="size-12 rounded-md border object-cover" />
              ) : (
                <span className="grid size-12 place-items-center rounded-md border bg-muted text-muted-foreground"><ImageOff className="size-4" aria-hidden="true" /></span>
              )}
              <div className="grid min-w-0 gap-0.5">
                <p className="text-sm font-medium break-words">{a.name}</p>
                <p className="truncate text-xs text-muted-foreground" title={[a.accountName, a.campaignName].filter(Boolean).join(" · ")}>
                  {adStatusLabel(a.status)} · {a.accountName}{a.campaignName ? ` · ${a.campaignName}` : ""}
                </p>
                <p className="text-xs text-muted-foreground tabular">
                  {a.source === "codigo" ? "Ligado pelo código no nome" : "Ligado à mão"}
                  {a.frequency !== null ? ` · frequência ${dec.format(a.frequency)} em 7 dias` : ""}
                  {a.fatigued && <span className="font-medium text-warning"> · criativo cansado</span>}
                </p>
                {canRequest && a.fatigued && <RequestFromAdLink adId={a.adId} adName={a.name} className="mt-1" />}
              </div>
              {canLink && (
                <Button variant="ghost" size="icon" disabled={pending} aria-label={`Desligar ${a.name}`} onClick={() => unlink(a)}>
                  {busy === a.adId ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Unlink aria-hidden="true" />}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canLink && (
        linkable.length === 0 ? (
          <p className="text-xs text-muted-foreground">Não há outros anúncios sincronizados nas contas deste cliente.</p>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={adId} onValueChange={setAdId}>
              <SelectTrigger className="w-full sm:flex-1" aria-label="Anúncio para ligar"><SelectValue placeholder="Escolha um anúncio do cliente…" /></SelectTrigger>
              <SelectContent>
                {linkable.map((a) => (
                  <SelectItem key={a.adId} value={a.adId}>{a.name} ({adStatusLabel(a.status)}{a.campaignName ? ` · ${a.campaignName}` : ""})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" disabled={pending} onClick={link}>
              {busy === "link" && <LoaderCircle className="animate-spin" aria-hidden="true" />} Ligar anúncio
            </Button>
          </div>
        )
      )}
    </div>
  );
}
