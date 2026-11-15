"use client";

import { useTransition } from "react";
import { FileText, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { centsToInput, formatBRL } from "@/domain/shared/money";
import { BUDGET_CHANNEL_LABEL, PLATFORM_LABEL, currentBudget, dailyBudget, type BudgetChannel } from "@/domain/traffic";
import { fileUrl } from "@/features/clients/actions";
import { deleteBudget } from "@/features/traffic/actions";
import type { BudgetRow } from "@/features/traffic/queries";
import { handleResult } from "@/lib/action-feedback";
import { cn } from "@/lib/utils";
import { BudgetDialog } from "./budget-dialog";

const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

/** Verbas aprovadas pelo cliente, com a vigente destacada e o comprovante para abrir. */
export function BudgetList({ clientId, today, rows, canManage }: { clientId: string; today: string; rows: BudgetRow[]; canManage: boolean }) {
  const [pending, run] = useTransition();
  const current = currentBudget(rows, today);
  const openProof = (path: string) =>
    run(async () => {
      const res = await fileUrl({ path });
      if (res.ok) window.open(res.data.url, "_blank", "noopener");
      else handleResult(res);
    });
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {rows.map((b) => {
        const daily = dailyBudget(b.amountCents, b.periodStart, b.periodEnd);
        const isCurrent = current?.id === b.id;
        return (
          <li key={b.id} className={cn("grid gap-x-4 gap-y-2 px-4 py-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto] md:items-center", isCurrent && "bg-brand/5")}>
            <div className="grid gap-0.5">
              <p className="text-sm font-medium tabular">
                {br(b.periodStart)} a {br(b.periodEnd)}
                {isCurrent && <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-xs font-medium text-primary-foreground">Vigente</span>}
              </p>
              <p className="text-xs text-muted-foreground">{PLATFORM_LABEL[b.platform]}</p>
            </div>
            <div className="grid gap-0.5">
              <p className="text-sm font-semibold tabular">{formatBRL(b.amountCents)}</p>
              <p className="text-xs text-muted-foreground tabular">{formatBRL(daily.perDayCents)} por dia em {daily.days} {daily.days === 1 ? "dia" : "dias"}</p>
            </div>
            <div className="grid min-w-0 gap-0.5 text-sm">
              <p className="break-words">
                {b.approvedBy} <span className="text-muted-foreground">· {BUDGET_CHANNEL_LABEL[b.channel as BudgetChannel] ?? b.channel} · {br(b.approvedOn)}</span>
              </p>
              {b.notes && <p className="text-xs text-muted-foreground break-words">{b.notes}</p>}
            </div>
            <div className="flex flex-wrap gap-1 md:justify-end">
              {b.proofPath && (
                <Button variant="outline" size="sm" disabled={pending} onClick={() => openProof(b.proofPath!)}>
                  <FileText aria-hidden="true" /> Comprovante
                </Button>
              )}
              {canManage && (
                <>
                  <BudgetDialog
                    clientId={clientId}
                    today={today}
                    id={b.id}
                    hasProof={Boolean(b.proofPath)}
                    initial={{ amount: centsToInput(b.amountCents), platform: b.platform, periodStart: b.periodStart, periodEnd: b.periodEnd, approvedBy: b.approvedBy, approvedOn: b.approvedOn, channel: b.channel, notes: b.notes ?? "" }}
                    trigger={<Button variant="ghost" size="icon" aria-label={`Alterar a verba de ${br(b.periodStart)} a ${br(b.periodEnd)}`}><Pencil /></Button>}
                  />
                  <ConfirmDialog
                    trigger={<Button variant="ghost" size="icon" className="text-danger" aria-label={`Apagar a verba de ${br(b.periodStart)} a ${br(b.periodEnd)}`}><Trash2 /></Button>}
                    title="Apagar esta verba?"
                    description="O registro sai da lista. O comprovante continua em Documentos › Tráfego."
                    confirmLabel="Apagar"
                    onConfirm={async () => handleResult(await deleteBudget({ id: b.id, clientId }))}
                  />
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
