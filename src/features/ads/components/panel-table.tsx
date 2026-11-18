import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { adStatusLabel, isRunning, RESULT_LABEL } from "@/domain/ads";
import { formatBRL } from "@/domain/shared/money";
import { formatDateTime } from "@/domain/shared/dates";
import type { AccountPanel } from "@/features/ads/queries";
import { cn } from "@/lib/utils";
import { CampaignAdjust } from "./campaign-adjust";

const int = new Intl.NumberFormat("pt-BR");
const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`);

export function StatusDot({ status }: { status: string | null }) {
  const on = isRunning(status);
  const bad = status === "DISAPPROVED" || status === "WITH_ISSUES";
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs whitespace-nowrap", bad ? "text-danger" : on ? "text-success" : "text-muted-foreground")}>
      <span className={cn("size-1.5 rounded-full", bad ? "bg-danger" : on ? "bg-success" : "bg-muted-foreground/50")} aria-hidden="true" />
      {adStatusLabel(status)}
    </span>
  );
}

/** Saldo da conta e previsão de dias (RF-ADS-04). */
export function Funds({ a }: { a: AccountPanel }) {
  if (!a.isPrepay) return <span className="text-muted-foreground">{a.fundingDisplay ?? "Pós-paga"}</span>;
  const low = a.daysLeft !== null && a.daysLeft <= 3;
  return (
    <span className={cn("whitespace-nowrap", low && "font-medium text-danger")}>
      Saldo {formatBRL(a.fundsCents)}
      {a.daysLeft !== null && <span className={low ? "" : "text-muted-foreground"}> · {a.daysLeft === 0 ? "acaba hoje" : `~${a.daysLeft} ${a.daysLeft === 1 ? "dia" : "dias"}`}</span>}
    </span>
  );
}

/** Painel do tráfego em tabela (computador) e cartões (celular): conta → campanhas do período. */
export function PanelTable({ accounts, showClient = true }: { accounts: AccountPanel[]; showClient?: boolean }) {
  return (
    <div className="grid gap-5">
      {accounts.map((a) => (
        <section key={a.id} aria-label={`${a.clientName ?? "Sem cliente"}: ${a.name}`} className="overflow-hidden rounded-xl border bg-card">
          <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b bg-muted/30 px-4 py-3">
            <div className="grid min-w-0">
              {showClient && a.clientId ? (
                <Link href={`/clientes/${a.clientId}/anuncios`} className="font-semibold break-words hover:underline">{a.clientName}</Link>
              ) : showClient ? <span className="font-semibold">Sem cliente</span> : null}
              <span className={cn("text-sm break-words", showClient && "text-muted-foreground")}>
                {a.name}{a.statusCode !== null && a.statusCode !== 1 ? " · conta com restrição" : ""}
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
              <Funds a={a} />
              <span className="font-medium whitespace-nowrap">Gasto {formatBRL(a.totals.spend_cents)}</span>
              <span className="text-xs text-muted-foreground">{a.syncedAt ? `Atualizado ${formatDateTime(a.syncedAt)}` : "Ainda não sincronizada"}</span>
            </div>
          </header>
          {a.syncError && (
            <p role="alert" className="flex items-start gap-2 border-b bg-danger-soft px-4 py-2 text-sm text-danger">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {a.syncError}
            </p>
          )}
          {a.campaigns.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Nenhuma campanha no ar nem com gasto no período.</p>
          ) : (
            <table className="w-full text-sm">
              <caption className="sr-only">Campanhas de {a.name}</caption>
              <thead className="hidden border-b text-left text-xs whitespace-nowrap text-muted-foreground md:table-header-group">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">Campanha</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Gasto</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Impressões</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">CTR</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">CPM</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Resultados</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Custo por resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {a.campaigns.map((c) => {
                  const label = RESULT_LABEL[c.kind];
                  const cell = (name: string, value: string) => (
                    <td className="md:px-3 md:py-2.5 md:text-right">
                      <span className="text-muted-foreground md:hidden">{name}: </span>
                      <span className="tabular">{value}</span>
                    </td>
                  );
                  return (
                    <tr key={c.id} className="grid grid-cols-2 gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-3 md:table-row md:p-0">
                      <th scope="row" className="col-span-full min-w-0 text-left font-normal md:px-4 md:py-2.5">
                        <span className="block font-medium break-words">{c.name}</span>
                        <StatusDot status={c.status} />
                        {c.dailyBudgetCents ? <span className="text-xs text-muted-foreground"> · {formatBRL(c.dailyBudgetCents)}/dia</span> : null}
                        {a.canManage && <div className="mt-1.5"><CampaignAdjust campaign={{ id: c.id, name: c.name, status: c.status, dailyBudgetCents: c.dailyBudgetCents }} /></div>}
                      </th>
                      {cell("Gasto", formatBRL(c.totals.spend_cents))}
                      {cell("Impressões", int.format(c.totals.impressions))}
                      {cell("CTR", pct(c.kpis.ctr))}
                      {cell("CPM", formatBRL(c.kpis.cpmCents))}
                      {cell("Resultados", c.kind === "impressions" ? "—" : `${int.format(c.kpis.results)} ${c.kpis.results === 1 ? label.one : label.many}`)}
                      <td className="md:px-4 md:py-2.5 md:text-right">
                        <span className="text-muted-foreground md:hidden">{label.cost}: </span>
                        <span className="tabular">{formatBRL(c.kpis.costPerResultCents)}</span>
                        <span className="hidden text-xs text-muted-foreground md:block">{label.cost.replace("Custo por ", "por ")}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </div>
  );
}
