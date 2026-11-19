import Link from "next/link";
import { RESULT_LABEL } from "@/domain/ads";
import { formatBRL } from "@/domain/shared/money";
import type { ModuleAdSet } from "@/features/ads/module-queries";
import { StatusDot } from "../panel-table";

const int = (v: number) => v.toLocaleString("pt-BR");
const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`);
const money = (c: number | null) => (c === null ? "—" : formatBRL(c));

/** Aba Conjuntos (como no HubSystem): orçamento do conjunto, campanha, cliente e números do período. */
export function AdSetsTable({ rows }: { rows: ModuleAdSet[] }) {
  if (!rows.length) return <p className="rounded-xl border border-dashed bg-surface px-4 py-6 text-sm text-muted-foreground">Nenhum conjunto no ar nem com gasto nestes filtros.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border bg-surface">
      <table className="w-full text-sm" aria-label="Conjuntos">
        <thead className="border-b bg-muted/40 text-left text-xs whitespace-nowrap text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-medium">Conjunto</th>
            <th scope="col" className="px-2.5 py-2.5 text-right font-medium">Orçamento</th>
            <th scope="col" className="px-2.5 py-2.5 text-right font-medium">Investimento</th>
            <th scope="col" className="px-2.5 py-2.5 text-right font-medium">Impressões</th>
            <th scope="col" className="px-2.5 py-2.5 text-right font-medium">CTR</th>
            <th scope="col" className="px-2.5 py-2.5 text-right font-medium">CPC</th>
            <th scope="col" className="px-2.5 py-2.5 text-right font-medium">Resultados</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Custo/resultado</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((s) => {
            const l = RESULT_LABEL[s.kind];
            return (
              <tr key={s.id} className="align-top hover:bg-muted/30">
                <th scope="row" className="max-w-64 min-w-52 px-4 py-2.5 text-left font-normal">
                  <span className="block font-medium break-words">{s.name}</span>
                  <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <StatusDot status={s.status} />
                    {s.clientId ? <Link href={`/clientes/${s.clientId}/anuncios`} className="hover:underline">{s.clientName}</Link> : null}
                    {s.campaignName && <span className="truncate">{s.campaignName}</span>}
                  </span>
                </th>
                <td className="px-2.5 py-2.5 text-right whitespace-nowrap tabular-nums">
                  {s.dailyBudgetCents !== null ? `${formatBRL(s.dailyBudgetCents)}/dia` : s.lifetimeBudgetCents !== null ? `${formatBRL(s.lifetimeBudgetCents)} total` : <span className="text-muted-foreground" title="Orçamento na campanha">na campanha</span>}
                </td>
                <td className="px-2.5 py-2.5 text-right font-medium whitespace-nowrap tabular-nums">{formatBRL(s.totals.spend_cents)}</td>
                <td className="px-2.5 py-2.5 text-right tabular-nums">{int(s.totals.impressions)}</td>
                <td className="px-2.5 py-2.5 text-right tabular-nums">{pct(s.kpis.ctr)}</td>
                <td className="px-2.5 py-2.5 text-right whitespace-nowrap tabular-nums">{money(s.kpis.cpcCents)}</td>
                <td className="px-2.5 py-2.5 text-right whitespace-nowrap tabular-nums">
                  {s.kind === "impressions" ? "—" : <>{int(s.kpis.results)} <span className="text-xs text-muted-foreground">{s.kpis.results === 1 ? l.one : l.many}</span></>}
                </td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap tabular-nums">{s.kind === "impressions" ? "—" : money(s.kpis.costPerResultCents)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
