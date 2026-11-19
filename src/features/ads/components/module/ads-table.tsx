import Link from "next/link";
import { ImageOff } from "lucide-react";
import { RESULT_LABEL } from "@/domain/ads";
import { formatBRL } from "@/domain/shared/money";
import type { ModuleAd } from "@/features/ads/module-queries";
import { RequestFromAdLink } from "@/features/creatives/components/request-from-ad";
import { StatusDot } from "../panel-table";

const int = (v: number) => v.toLocaleString("pt-BR");
const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`);

/** Aba Anúncios: miniatura, situação (com o motivo da reprovação), campanha, cliente e números do período. */
export function AdsTable({ rows, canRequest }: { rows: ModuleAd[]; canRequest: boolean }) {
  if (!rows.length) return <p className="rounded-xl border border-dashed bg-surface px-4 py-6 text-sm text-muted-foreground">Nenhum anúncio no ar nem com gasto nestes filtros.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border bg-surface">
      <table className="w-full text-sm" aria-label="Anúncios">
        <thead className="border-b bg-muted/40 text-left text-xs whitespace-nowrap text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-medium">Anúncio</th>
            <th scope="col" className="px-2.5 py-2.5 text-right font-medium">Investimento</th>
            <th scope="col" className="px-2.5 py-2.5 text-right font-medium">Impressões</th>
            <th scope="col" className="px-2.5 py-2.5 text-right font-medium">CTR</th>
            <th scope="col" className="px-2.5 py-2.5 text-right font-medium">Resultados</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Custo/resultado</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((a) => {
            const l = RESULT_LABEL[a.kind];
            return (
              <tr key={a.id} className="align-top hover:bg-muted/30">
                <th scope="row" className="max-w-sm min-w-64 px-4 py-2.5 text-left font-normal">
                  <div className="flex gap-3">
                    {a.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- miniatura da Meta (link externo assinado)
                      <img src={a.thumbnailUrl} alt="" width={48} height={48} loading="lazy" referrerPolicy="no-referrer" className="size-12 shrink-0 rounded-md bg-muted object-cover" />
                    ) : (
                      <span className="grid size-12 shrink-0 place-items-center rounded-md bg-muted"><ImageOff className="size-4 text-muted-foreground" aria-hidden="true" /></span>
                    )}
                    <span className="grid min-w-0 gap-0.5">
                      <span className="font-medium break-words">{a.name}</span>
                      <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <StatusDot status={a.status} />
                        {a.clientId ? <Link href={`/clientes/${a.clientId}/anuncios`} className="hover:underline">{a.clientName}</Link> : null}
                        {a.campaignName && <span className="truncate">{a.campaignName}</span>}
                      </span>
                      {a.reviewFeedback && <span className="line-clamp-2 text-xs break-words text-danger" title={a.reviewFeedback}>Meta: {a.reviewFeedback}</span>}
                      {canRequest && a.clientId && <RequestFromAdLink adId={a.id} adName={a.name} />}
                    </span>
                  </div>
                </th>
                <td className="px-2.5 py-2.5 text-right font-medium whitespace-nowrap tabular-nums">{formatBRL(a.totals.spend_cents)}</td>
                <td className="px-2.5 py-2.5 text-right tabular-nums">{int(a.totals.impressions)}</td>
                <td className="px-2.5 py-2.5 text-right tabular-nums">{pct(a.kpis.ctr)}</td>
                <td className="px-2.5 py-2.5 text-right whitespace-nowrap tabular-nums">
                  {a.kind === "impressions" ? "—" : <>{int(a.kpis.results)} <span className="text-xs text-muted-foreground">{a.kpis.results === 1 ? l.one : l.many}</span></>}
                </td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap tabular-nums">{a.kind === "impressions" || a.kpis.costPerResultCents === null ? "—" : formatBRL(a.kpis.costPerResultCents)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
