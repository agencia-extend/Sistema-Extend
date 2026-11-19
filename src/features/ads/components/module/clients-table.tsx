import Link from "next/link";
import { BellRing, TriangleAlert } from "lucide-react";
import { delta } from "@/domain/ads/filters";
import { formatBRL } from "@/domain/shared/money";
import type { ClientSummary } from "@/features/ads/module-queries";
import { cn } from "@/lib/utils";

/** Aba Clientes: gasto (com a variação), resultados, custo, saldo, campanhas no ar e alertas abertos. */
export function ClientsTable({ rows, query }: { rows: ClientSummary[]; query: string }) {
  if (!rows.length) return <p className="rounded-xl border border-dashed bg-surface px-4 py-6 text-sm text-muted-foreground">Nenhum cliente com conta ligada nestes filtros.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border bg-surface">
      <table className="w-full text-sm" aria-label="Clientes">
        <thead className="border-b bg-muted/40 text-left text-xs whitespace-nowrap text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-medium">Cliente</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Investimento</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Variação</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Resultados</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Custo/resultado</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Saldo</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">No ar</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Alertas</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => {
            const d = delta(r.totals.spend_cents, r.previousSpendCents);
            const low = r.accounts.find((a) => a.daysLeft !== null && a.daysLeft <= 3);
            const prepaid = r.accounts.filter((a) => a.isPrepay && a.fundsCents !== null);
            return (
              <tr key={r.clientId ?? r.clientName} className="hover:bg-muted/30">
                <th scope="row" className="min-w-48 px-4 py-2.5 text-left font-normal">
                  {r.clientId ? (
                    <Link href={`/anuncios/campanhas?${query}&cliente=${r.clientId}`} className="font-medium break-words hover:underline">{r.clientName}</Link>
                  ) : <span className="font-medium">{r.clientName}</span>}
                  <span className="block text-xs text-muted-foreground">
                    {r.accounts.length} {r.accounts.length === 1 ? "conta" : "contas"}
                    {r.accounts.some((a) => a.syncError) && <span className="text-danger"> · erro na sincronização</span>}
                  </span>
                </th>
                <td className="px-3 py-2.5 text-right font-medium whitespace-nowrap tabular-nums">{formatBRL(r.totals.spend_cents)}</td>
                <td className="px-3 py-2.5 text-right text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                  {d.pct === null ? "sem base" : d.pct === 0 ? "igual" : `${d.up ? "+" : ""}${d.pct}%`}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{r.results.toLocaleString("pt-BR")}</td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">{r.costPerResultCents === null ? "—" : formatBRL(r.costPerResultCents)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {prepaid.length === 0 ? <span className="text-muted-foreground">Pós-paga</span> : (
                    <span className={cn("tabular-nums", low && "font-medium text-danger")}>
                      {low && <TriangleAlert className="mr-1 inline size-3.5" aria-label="Saldo acabando" />}
                      {formatBRL(prepaid.reduce((s, a) => s + (a.fundsCents ?? 0), 0))}
                      {low && low.daysLeft !== null ? ` · ${low.daysLeft === 0 ? "acaba hoje" : `~${low.daysLeft} d`}` : ""}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{r.activeCampaigns}</td>
                <td className="px-4 py-2.5 text-right">
                  {r.openAlerts > 0 ? (
                    <Link href="/anuncios/alertas" className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger hover:underline" aria-label={`${r.openAlerts} alertas abertos de ${r.clientName}`}>
                      <BellRing className="size-3" aria-hidden="true" /> {r.openAlerts}
                    </Link>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
