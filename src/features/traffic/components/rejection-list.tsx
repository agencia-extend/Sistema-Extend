"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { CREATIVE_FORMAT_LABEL, type CreativeFormat } from "@/domain/creatives";
import { avoidSummary, REJECTION_OUTCOME_LABEL, REJECTION_REASON, type RejectionOutcome, type RejectionReason } from "@/domain/creatives/rejections";
import { deleteRejection } from "@/features/traffic/actions";
import type { LibraryOption, RejectionRow } from "@/features/traffic/queries";
import { handleResult } from "@/lib/action-feedback";
import { cn } from "@/lib/utils";
import { RejectionDialog } from "./rejection-dialog";

const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}`;
const fmt = (f: string) => CREATIVE_FORMAT_LABEL[f as CreativeFormat] ?? f;
const reasonLabel = (r: string) => REJECTION_REASON[r as RejectionReason]?.label ?? r;

/** Reprovações do cliente: os motivos que mais se repetem no topo e a lista, da mais recente para a mais antiga. */
export function RejectionList({ clientId, today, rows, library, canManage }: { clientId: string; today: string; rows: RejectionRow[]; library: LibraryOption[]; canManage: boolean }) {
  const top = avoidSummary(rows, 4);
  return (
    <div className="grid gap-4">
      {rows.length > 1 && (
        <div className="grid gap-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Motivos que mais se repetem</h3>
          <ul className="flex flex-wrap gap-2">
            {top.map((t) => (
              <li key={t.reason} className="rounded-full border bg-card px-3 py-1 text-sm">
                {REJECTION_REASON[t.reason].label} <span className="font-semibold tabular">{t.count}</span>
                {t.formats.length > 0 && <span className="text-muted-foreground"> · {t.formats.map(fmt).join(", ")}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <ol className="divide-y rounded-xl border bg-card">
        {rows.map((r) => {
          const editable = canManage && r.source === "manual";
          return (
            <li key={r.id} className="grid gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto]">
              <span className="text-sm font-medium tabular">{br(r.rejectedOn)}</span>
              <div className="grid min-w-0 gap-1">
                <p className="text-xs text-muted-foreground">
                  {r.platform === "google" ? "Google Ads" : "Meta"}{r.format ? ` · ${fmt(r.format)}` : ""}
                  {r.libraryCampaign ? ` · campanha ${r.libraryCampaign}` : ""}
                  {r.adName ? ` · ${r.adName}` : ""}
                  {r.source === "sync" ? " · detectada na sincronização" : r.authorName ? ` · ${r.authorName}` : ""}
                </p>
                <p className="text-sm font-medium break-words">{reasonLabel(r.reason)}: {r.angle}</p>
                <p className="text-sm text-muted-foreground break-words"><span className="sr-only">O que a Meta disse: </span>{r.policyText}</p>
                {r.lesson && <p className="text-sm break-words"><span className="font-medium">Evitar:</span> {r.lesson}</p>}
                <p>
                  <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs", r.outcome === "contestado_aprovado" || r.outcome === "corrigido" ? "bg-success-soft text-success" : r.outcome ? "bg-neutral-soft text-neutral-status" : "bg-warning-soft text-warning")}>
                    {r.outcome ? REJECTION_OUTCOME_LABEL[r.outcome as RejectionOutcome] : "Em aberto"}
                  </span>
                </p>
              </div>
              {editable && (
                <div className="flex gap-1 sm:self-start">
                  <RejectionDialog
                    clientId={clientId}
                    today={today}
                    library={library}
                    id={r.id}
                    initial={{
                      libraryId: r.libraryId ?? "__nenhum",
                      platform: r.platform,
                      rejectedOn: r.rejectedOn,
                      format: r.format ?? "",
                      angle: r.angle,
                      reason: r.reason,
                      policyText: r.policyText,
                      adName: r.adName ?? "",
                      outcome: r.outcome ?? "__nenhum",
                      lesson: r.lesson ?? "",
                    }}
                    trigger={<Button variant="ghost" size="icon" aria-label={`Atualizar a reprovação: ${r.angle}`}><Pencil /></Button>}
                  />
                  <ConfirmDialog
                    trigger={<Button variant="ghost" size="icon" className="text-danger" aria-label={`Apagar a reprovação: ${r.angle}`}><Trash2 /></Button>}
                    title="Apagar esta reprovação?"
                    description="Ela sai do histórico de reprovações e do aviso no pedido de criativo. A linha no histórico do cliente continua."
                    confirmLabel="Apagar"
                    onConfirm={async () => handleResult(await deleteRejection({ id: r.id, clientId }))}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
