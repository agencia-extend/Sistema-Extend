import { TrendingDown, TrendingUp } from "lucide-react";
import type { Totals } from "@/domain/ads";
import { delta } from "@/domain/ads/filters";
import { formatBRL } from "@/domain/shared/money";
import { cn } from "@/lib/utils";

const int = (v: number) => v.toLocaleString("pt-BR");
const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`);
const money = (c: number | null) => (c === null ? "—" : formatBRL(c));

/** Número que nunca vaza do cartão: a fonte diminui com o tamanho do texto (pai com @container). */
function FitNumber({ text, maxRem = 1.5 }: { text: string; maxRem?: number }) {
  return (
    <span className="block font-semibold tracking-tight whitespace-nowrap tabular-nums" style={{ fontSize: `min(${maxRem}rem, calc(100cqw / ${(Math.max(text.length, 1) * 0.58).toFixed(2)}))` }}>
      {text}
    </span>
  );
}

/** Indicador com a comparação ao período anterior (ícone e texto, não só cor). `invert`: subir é ruim; `neutral`: nem bom nem ruim (investimento). */
export function Kpi({ label, value, previous, isMoney, invert, neutral, hint }: { label: string; value: number; previous?: number; isMoney?: boolean; invert?: boolean; neutral?: boolean; hint?: string }) {
  const fmt = (v: number) => (isMoney ? formatBRL(v) : int(v));
  const d = previous !== undefined ? delta(value, previous) : null;
  const good = d ? (invert ? !d.up : d.up) : true;
  return (
    <div className="@container grid min-w-0 content-start gap-1 rounded-xl border bg-surface p-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0"><FitNumber text={fmt(value)} /></dd>
      {d && (
        <dd className={cn("flex min-w-0 flex-wrap items-center gap-1 text-xs break-words", d.pct === 0 || d.pct === null || neutral ? "text-muted-foreground" : good ? "text-success" : "text-danger")}>
          {d.pct !== 0 && d.pct !== null && (d.up ? <TrendingUp className="size-3.5" aria-hidden="true" /> : <TrendingDown className="size-3.5" aria-hidden="true" />)}
          {d.pct === null ? "Sem base no período anterior" : d.pct === 0 ? "Igual ao período anterior" : `${d.up ? "+" : ""}${d.pct}% vs. anterior (${fmt(previous!)})`}
        </dd>
      )}
      {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}

const results = (t: Totals) => t.leads + t.messages + t.purchases;

/** Indicadores principais com a comparação ao período anterior. */
export function KpiGrid({ totals, previous }: { totals: Totals; previous: Totals }) {
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Kpi label="Investimento" value={totals.spend_cents} previous={previous.spend_cents} isMoney neutral />
      <Kpi label="Impressões" value={totals.impressions} previous={previous.impressions} />
      <Kpi label="Cliques no link" value={totals.link_clicks} previous={previous.link_clicks} />
      <Kpi label="Leads" value={totals.leads} previous={previous.leads} />
      <Kpi label="Conversas" value={totals.messages} previous={previous.messages} hint="Conversas iniciadas no WhatsApp, Messenger e Direct." />
      <Kpi label="Compras" value={totals.purchases} previous={previous.purchases} />
    </dl>
  );
}

/** Eficiência: custo e retorno por unidade. */
export function EfficiencyGrid({ totals }: { totals: Totals }) {
  const clicks = totals.link_clicks || totals.clicks;
  const r = results(totals);
  const items: [string, string, string][] = [
    ["CTR", pct(totals.impressions ? clicks / totals.impressions : null), "Cliques no link ÷ impressões"],
    ["CPC", money(clicks ? Math.round(totals.spend_cents / clicks) : null), "Custo por clique no link"],
    ["CPM", money(totals.impressions ? Math.round((totals.spend_cents / totals.impressions) * 1000) : null), "Custo por mil impressões"],
    ["Custo por resultado", money(r ? Math.round(totals.spend_cents / r) : null), "Investimento ÷ (leads + conversas + compras)"],
    ["ROAS", totals.spend_cents && totals.purchase_value_cents ? `${(totals.purchase_value_cents / totals.spend_cents).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}x` : "—", "Valor das compras ÷ investimento"],
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {items.map(([label, value, hint]) => (
        <div key={label} className="@container grid min-w-0 content-start gap-1 rounded-xl border bg-surface p-4">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="min-w-0"><FitNumber text={value} maxRem={1.25} /></dd>
          <dd className="text-xs text-muted-foreground">{hint}</dd>
        </div>
      ))}
    </dl>
  );
}
