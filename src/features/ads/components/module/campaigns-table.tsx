import Link from "next/link";
import { RESULT_LABEL } from "@/domain/ads";
import { formatBRL } from "@/domain/shared/money";
import type { ModuleCampaign } from "@/features/ads/module-queries";
import { CampaignAdjust } from "../campaign-adjust";
import { StatusDot } from "../panel-table";

const int = (v: number) => v.toLocaleString("pt-BR");
const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`);
const money = (c: number | null) => (c === null ? "—" : formatBRL(c));

/**
 * Tabela de campanhas (como a MetricsTable do HubSystem): nome com cliente e conta, situação, orçamento, números do
 * período e "Ajustar" (pausar, ativar, orçamento, renomear e duplicar) para quem cuida do tráfego do cliente.
 */
export function CampaignsTable({ rows, label, empty, showClient = true }: { rows: ModuleCampaign[]; label: string; empty: string; showClient?: boolean }) {
  if (!rows.length) return <p className="rounded-xl border border-dashed bg-surface px-4 py-6 text-sm text-muted-foreground">{empty}</p>;
  const withRoas = rows.some((r) => r.totals.purchase_value_cents > 0);
  return (
    <div className="overflow-x-auto rounded-xl border bg-surface">
      <table className="w-full text-sm" aria-label={label}>
        <thead className="border-b bg-muted/40 text-left text-xs whitespace-nowrap text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-medium">Campanha</th>
            <th scope="col" className="px-2.5 py-2.5 text-right font-medium">Orçamento/dia</th>
            <th scope="col" className="px-2.5 py-2.5 text-right font-medium">Investimento</th>
            <th scope="col" className="px-2.5 py-2.5 text-right font-medium">Impressões</th>
            <th scope="col" className="px-2.5 py-2.5 text-right font-medium">Cliques</th>
            <th scope="col" className="px-2.5 py-2.5 text-right font-medium">CTR</th>
            <th scope="col" className="px-2.5 py-2.5 text-right font-medium">CPC</th>
            <th scope="col" className="px-2.5 py-2.5 text-right font-medium">Resultados</th>
            <th scope="col" className="px-2.5 py-2.5 text-right font-medium">Custo/resultado</th>
            {withRoas && <th scope="col" className="px-2.5 py-2.5 text-right font-medium">ROAS</th>}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((c) => {
            const l = RESULT_LABEL[c.kind];
            const clicks = c.totals.link_clicks || c.totals.clicks;
            return (
              <tr key={c.id} className="align-top hover:bg-muted/30">
                <th scope="row" className="max-w-64 min-w-52 px-4 py-2.5 text-left font-normal">
                  <span className="block font-medium break-words">{c.name}</span>
                  <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <StatusDot status={c.status} />
                    {showClient && (c.clientId ? <Link href={`/clientes/${c.clientId}/anuncios`} className="hover:underline">{c.clientName}</Link> : <span>Sem cliente</span>)}
                    <span className="truncate">{c.accountName}</span>
                  </span>
                  {c.canManage && <div className="mt-1.5"><CampaignAdjust campaign={{ id: c.id, name: c.name, status: c.status, dailyBudgetCents: c.dailyBudgetCents }} /></div>}
                </th>
                <td className="px-2.5 py-2.5 text-right whitespace-nowrap tabular-nums">{money(c.dailyBudgetCents)}</td>
                <td className="px-2.5 py-2.5 text-right font-medium whitespace-nowrap tabular-nums">{formatBRL(c.totals.spend_cents)}</td>
                <td className="px-2.5 py-2.5 text-right tabular-nums">{int(c.totals.impressions)}</td>
                <td className="px-2.5 py-2.5 text-right tabular-nums">{int(clicks)}</td>
                <td className="px-2.5 py-2.5 text-right tabular-nums">{pct(c.kpis.ctr)}</td>
                <td className="px-2.5 py-2.5 text-right whitespace-nowrap tabular-nums">{money(c.kpis.cpcCents)}</td>
                <td className="px-2.5 py-2.5 text-right whitespace-nowrap tabular-nums">
                  {c.kind === "impressions" ? "—" : <>{int(c.kpis.results)} <span className="text-xs text-muted-foreground">{c.kpis.results === 1 ? l.one : l.many}</span></>}
                </td>
                <td className="px-2.5 py-2.5 text-right whitespace-nowrap tabular-nums">{c.kind === "impressions" ? "—" : money(c.kpis.costPerResultCents)}</td>
                {withRoas && <td className="px-2.5 py-2.5 text-right tabular-nums">{c.kpis.roas === null ? "—" : `${c.kpis.roas.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}x`}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
