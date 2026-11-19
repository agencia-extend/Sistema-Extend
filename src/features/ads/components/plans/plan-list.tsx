import Link from "next/link";
import { Link2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RESULT_LABEL } from "@/domain/ads";
import { PLAN_OBJECTIVE_LABEL, PLAN_PLATFORM_LABEL, PLAN_STATUS_LABEL, type PlanStatus } from "@/domain/ads/plans";
import { centsToInput, formatBRL } from "@/domain/shared/money";
import type { PlanRow } from "@/features/ads/plan-queries";
import { cn } from "@/lib/utils";
import { StatusDot } from "../panel-table";
import { PlanDelete } from "./plan-delete";
import { PlanDialog } from "./plan-dialog";
import { PlanLinkDialog } from "./plan-link-dialog";
import { PlanStatusDialog } from "./plan-status-dialog";

const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const TONE: Record<PlanStatus, string> = {
  rascunho: "bg-muted text-muted-foreground",
  aprovado: "bg-info-soft text-info",
  no_ar: "bg-success-soft text-success",
  encerrado: "bg-muted text-muted-foreground line-through decoration-1",
};

/** Planos de campanha: o planejado, a campanha ligada e o que já foi gasto, com o ritmo do gasto. */
export function PlanList({ rows, today, showClient, manageable }: { rows: PlanRow[]; today: string; showClient: boolean; manageable: Set<string> }) {
  return (
    <ul className="grid gap-3" aria-label="Planos de campanha">
      {rows.map((p) => {
        const can = manageable.has(p.clientId);
        const s = p.spent;
        const l = s ? RESULT_LABEL[s.kind] : null;
        return (
          <li key={p.id} className="grid gap-3 rounded-xl border bg-surface p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] lg:items-start">
            <div className="grid min-w-0 gap-1">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-medium break-all">{p.name}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", TONE[p.status])}>{PLAN_STATUS_LABEL[p.status]}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {showClient && <><Link href={`/clientes/${p.clientId}/trafego#planos`} className="hover:underline">{p.clientName}</Link> · </>}
                {PLAN_PLATFORM_LABEL[p.platform]} · {PLAN_OBJECTIVE_LABEL[p.objective]}
              </p>
              {p.status !== "rascunho" && p.approvedBy && <p className="text-xs text-muted-foreground">Aprovado por {p.approvedBy} em {br(p.approvedOn!)}</p>}
              <details className="group text-sm">
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Público e criativos ({p.creatives.length})</summary>
                <div className="mt-2 grid gap-2">
                  <p className="break-words whitespace-pre-line">{p.audience}</p>
                  {p.creatives.length ? (
                    <ul className="grid gap-0.5 text-xs" aria-label="Criativos do plano">{p.creatives.map((c) => <li key={c.kind + c.id} className="break-words">{c.label}</li>)}</ul>
                  ) : <p className="text-xs text-muted-foreground">Nenhum criativo escolhido.</p>}
                  {p.notes && <p className="text-xs break-words whitespace-pre-line text-muted-foreground">{p.notes}</p>}
                </div>
              </details>
            </div>

            <dl className="grid gap-0.5 text-sm">
              <dt className="sr-only">Orçamento</dt>
              <dd className="font-semibold tabular-nums">{formatBRL(p.budgetCents)}{p.budgetType === "diario" ? "/dia" : " no total"}</dd>
              <dt className="sr-only">Período</dt>
              <dd className="text-xs text-muted-foreground tabular-nums">{br(p.startDate)} {p.endDate ? `a ${br(p.endDate)}` : "· sem data de fim"}</dd>
              {p.budgetType === "diario" && p.plannedTotalCents !== null && <dd className="text-xs text-muted-foreground tabular-nums">Previsto no período: {formatBRL(p.plannedTotalCents)}</dd>}
            </dl>

            <div className="grid min-w-0 gap-1 text-sm">
              {p.campaign ? (
                <>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span>Campanha {p.campaign.linkSource === "auto" ? "ligada pelo nome" : "ligada à mão"}</span>
                    <StatusDot status={p.campaign.status} />
                  </p>
                  {p.campaign.name !== p.name && <p className="text-xs break-all">{p.campaign.name}</p>}
                  {s ? (
                    <>
                      <p className="tabular-nums">
                        <span className="font-medium">{formatBRL(s.totals.spend_cents)}</span>
                        {p.plannedTotalCents !== null && <span className="text-muted-foreground"> de {formatBRL(p.plannedTotalCents)}</span>}
                        {s.kind !== "impressions" && l && <span className="text-muted-foreground"> · {s.kpis.results.toLocaleString("pt-BR")} {s.kpis.results === 1 ? l.one : l.many}{s.kpis.costPerResultCents !== null && <span className="whitespace-nowrap"> a {formatBRL(s.kpis.costPerResultCents)}</span>}</span>}
                      </p>
                      {p.pace && <p className={cn("text-xs", p.pace.tone === "ok" ? "text-success" : "text-warning")}>{p.pace.label}</p>}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">O gasto aparece a partir de {br(p.startDate)}.</p>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {p.status === "encerrado" ? "Sem campanha ligada." : "Aguardando a campanha com este nome aparecer na conta (a sincronização roda a cada 3 horas)."}
                </p>
              )}
            </div>

            {can && (
              <div className="flex flex-wrap gap-1 lg:justify-end">
                <PlanStatusDialog id={p.id} clientId={p.clientId} name={p.name} status={p.status} today={today}
                  trigger={<Button variant="outline" size="sm" aria-label={`Mudar a situação do plano ${p.name}`}>Situação</Button>} />
                <PlanLinkDialog id={p.id} clientId={p.clientId} platform={p.platform} linked={p.campaign ? { id: p.campaign.id, name: p.campaign.name } : null}
                  trigger={<Button variant="ghost" size="icon" aria-label={`Campanha do plano ${p.name}`}><Link2 /></Button>} />
                <PlanDialog
                  id={p.id}
                  today={today}
                  clients={[{ id: p.clientId, name: p.clientName }]}
                  initial={{
                    clientId: p.clientId, name: p.name, platform: p.platform, objective: p.objective, budgetType: p.budgetType, budget: centsToInput(p.budgetCents),
                    audience: p.audience, startDate: p.startDate, endDate: p.endDate ?? "", notes: p.notes ?? "",
                    libraryIds: p.creatives.filter((c) => c.kind === "library").map((c) => c.id), requestIds: p.creatives.filter((c) => c.kind === "request").map((c) => c.id),
                  }}
                  trigger={<Button variant="ghost" size="icon" aria-label={`Alterar o plano ${p.name}`}><Pencil /></Button>}
                />
                <PlanDelete id={p.id} clientId={p.clientId} name={p.name} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
