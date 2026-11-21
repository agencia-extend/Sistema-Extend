import Link from "next/link";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/app/states";
import { LEAD_QUALITY_LABEL } from "@/domain/ads/client-leads";
import { formatPhone } from "@/domain/crm";
import { formatBRL } from "@/domain/shared/money";
import { LEAD_PERIODS, type ClientLeadItem, type LeadPeriod } from "@/features/ads/leads/queries";
import type { QualityRow } from "@/domain/ads/client-leads";
import { cn } from "@/lib/utils";
import { LeadRating } from "./lead-rating";

const SHOW = 50;
const dt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
const TONE = { bom: "text-success", medio: "text-info", ruim: "text-danger", nao_atendeu: "text-muted-foreground" } as const;

/** Qualidade dos leads do cliente (RF-T2-01): por campanha e lead a lead, no período escolhido. */
export function LeadQuality({ clientId, period, summary, leads, allTime, canManage }: {
  clientId: string;
  period: LeadPeriod;
  summary: { rows: QualityRow[]; total: QualityRow };
  leads: ClientLeadItem[];
  allTime: number;
  canManage: boolean;
}) {
  const t = summary.total;
  return (
    <div className="grid gap-4">
      <nav aria-label="Período dos leads" className="flex flex-wrap gap-1.5">
        {(Object.keys(LEAD_PERIODS) as LeadPeriod[]).map((p) => (
          <Link key={p} href={`?leads=${p}#leads`} scroll={false} aria-current={p === period ? "page" : undefined}
            className={cn("rounded-full border px-3 py-1 text-sm", p === period ? "border-brand bg-accent font-medium text-accent-foreground" : "hover:bg-muted")}>
            {LEAD_PERIODS[p]}
          </Link>
        ))}
      </nav>

      {!leads.length ? (
        <EmptyState
          icon={Users}
          title={allTime ? "Nenhum lead neste período" : "Nenhum lead importado"}
          description={allTime
            ? "Escolha outro período ou importe a planilha mais recente."
            : canManage
              ? "Importe a planilha da Central de leads da Meta (ou do CRM do cliente) e mande o link de avaliação ao cliente. Aqui aparecem a % de leads qualificados e o custo por lead qualificado de cada campanha."
              : "A equipe de tráfego importa aqui os leads das campanhas deste cliente."}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">Qualidade dos leads por campanha</caption>
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Campanha</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Leads</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Avaliados</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Bom · Médio · Ruim · Não atendeu</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Qualificados</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Custo por qualificado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[...summary.rows, t].map((r) => (
                  <tr key={r.key} className={cn(r.key === "total" && "bg-muted/50 font-medium")}>
                    <th scope="row" className="max-w-72 px-3 py-2 text-left font-normal break-words">
                      <span className={cn(r.key === "total" && "font-medium")}>{r.label}</span>
                      {r.key !== "total" && !r.campaignId && r.label !== "Sem campanha" && <span className="block text-xs text-muted-foreground">Não encontrada nas contas do cliente</span>}
                    </th>
                    <td className="px-3 py-2 text-right tabular-nums">{r.leads}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.rated}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums text-muted-foreground">{r.counts.bom} · {r.counts.medio} · {r.counts.ruim} · {r.counts.nao_atendeu}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{pct(r.pctQualified)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">{r.costPerQualifiedCents === null ? "—" : formatBRL(r.costPerQualifiedCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Qualificado = bom ou médio, sobre os avaliados. O custo usa o gasto da campanha no período{t.spendCents !== null ? ` (${formatBRL(t.spendCents)} nas campanhas ligadas)` : ""}.
          </p>

          <ul className="divide-y rounded-xl border bg-card" aria-label="Leads do período">
            {leads.slice(0, SHOW).map((l) => {
              const label = l.name ?? (l.phone ? formatPhone(l.phone) : l.email) ?? "Lead";
              return (
                <li key={l.id} className="grid gap-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="grid min-w-0 gap-0.5">
                    <p className="text-sm font-medium break-words">{label}</p>
                    <p className="text-xs break-words text-muted-foreground">
                      {[dt.format(new Date(l.leadAt)), l.name && l.phone ? formatPhone(l.phone) : null, l.campaignName, l.adName].filter(Boolean).join(" · ")}
                    </p>
                    {l.quality && (
                      <p className="text-xs break-words">
                        <span className={cn("font-medium", TONE[l.quality])}>{LEAD_QUALITY_LABEL[l.quality]}</span>
                        {l.ratedBy && <span className="text-muted-foreground"> por {l.ratedBy}</span>}
                        {l.note && <span className="text-muted-foreground">: {l.note}</span>}
                      </p>
                    )}
                  </div>
                  {canManage && <LeadRating id={l.id} clientId={clientId} quality={l.quality} label={label} />}
                </li>
              );
            })}
          </ul>
          {leads.length > SHOW && <p className="text-xs text-muted-foreground">Mostrando os {SHOW} mais recentes de {leads.length.toLocaleString("pt-BR")} leads no período.</p>}
        </>
      )}
    </div>
  );
}
