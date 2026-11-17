import { costPerResult, creativeKpis, type CreativeTotals } from "@/domain/creatives/performance";
import { formatBRL } from "@/domain/shared/money";
import { cn } from "@/lib/utils";

const pct = new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 2 });
const int = new Intl.NumberFormat("pt-BR");
const dec = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });

export const fmtPct = (v: number | null) => (v === null ? "—" : pct.format(v));
export const fmtBRL = (v: number | null) => (v === null ? "—" : formatBRL(v));

/** Linha curta para o cartão da biblioteca: investimento, CTR, custo por resultado e dias no ar. */
export function PerformanceLine({ t, className }: { t: CreativeTotals; className?: string }) {
  const k = creativeKpis(t);
  const cpr = costPerResult(t);
  const what = t.leads ? "lead" : t.messages ? "conversa" : t.purchases ? "compra" : null;
  return (
    <p className={cn("text-xs tabular text-muted-foreground", className)}>
      <span className="font-medium text-foreground">{formatBRL(t.spendCents)}</span> · CTR {fmtPct(k.ctr)}
      {what && cpr !== null ? ` · ${formatBRL(cpr)} por ${what}` : ""}
      {k.hookRate !== null ? ` · hook ${fmtPct(k.hookRate)}` : ""} · {t.daysLive} {t.daysLive === 1 ? "dia" : "dias"} no ar
    </p>
  );
}

/** Tabela completa (página do criativo). */
export function PerformanceTable({ t }: { t: CreativeTotals }) {
  const k = creativeKpis(t);
  const rows: [string, string][] = [
    ["Investimento", formatBRL(t.spendCents)],
    ["Impressões", int.format(t.impressions)],
    ["CTR", fmtPct(k.ctr)],
    ["CPC", fmtBRL(k.cpcCents)],
    ["CPM", fmtBRL(k.cpmCents)],
    ["Leads", int.format(t.leads)],
    ["CPL", fmtBRL(k.cplCents)],
    ["Conversas", int.format(t.messages)],
    ["Custo por conversa", fmtBRL(k.costPerMessageCents)],
    ["Hook rate", fmtPct(k.hookRate)],
    ["Hold rate", fmtPct(k.holdRate)],
    ["Frequência (7 dias)", t.frequency === null ? "—" : dec.format(t.frequency)],
    ["ROAS", k.roas === null ? "—" : `${dec.format(k.roas)}×`],
    ["Dias no ar", int.format(t.daysLive)],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-0.5">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="font-medium tabular">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
