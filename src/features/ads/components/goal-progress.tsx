import { goalLines, type GoalLine } from "@/domain/ads/goals";
import { formatBRL } from "@/domain/shared/money";
import type { ClientGoal } from "@/features/ads/queries";
import { cn } from "@/lib/utils";

const int = new Intl.NumberFormat("pt-BR");

function fmt(l: GoalLine, v: number | null) {
  if (v === null) return "—";
  if (l.key === "spend" || l.key === "cost") return formatBRL(v);
  if (l.key === "roas") return v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return int.format(v);
}

/** Progresso das metas do mês (RF-T2-04): realizado até ontem, projeção no ritmo atual e situação. */
export function GoalProgress({ goal, actual, today }: { goal: ClientGoal; actual: { spendCents: number; results: number; purchaseValueCents: number }; today: string }) {
  const lines = goalLines(goal, actual, today);
  return (
    <ul className="grid gap-3 sm:grid-cols-2" aria-label="Metas do mês">
      {lines.map((l) => {
        const pct = l.ratio === null ? 0 : Math.min(100, Math.round(l.ratio * 100));
        const tone = l.state === "ok" ? "success" : l.state === "atencao" ? "warning" : "muted";
        return (
          <li key={l.key} className="grid gap-2 rounded-xl border bg-card p-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium">{l.label}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", tone === "success" ? "bg-success-soft text-success" : tone === "warning" ? "bg-warning-soft text-warning" : "bg-muted text-muted-foreground")}>
                {l.state === "ok" ? "No ritmo" : l.state === "atencao" ? (l.higherIsBetter ? "Abaixo da meta" : "Acima do limite") : "Poucos dados"}
              </span>
            </div>
            <p className="text-sm tabular">
              <span className="text-base font-semibold">{fmt(l, l.actual)}</span>
              <span className="text-muted-foreground"> {l.higherIsBetter ? "de" : "limite"} {fmt(l, l.target)}</span>
            </p>
            {l.key !== "cost" && l.key !== "roas" && (
              <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${l.label}: ${pct}% da meta`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className={cn("h-full rounded-full", tone === "warning" ? "bg-warning" : "bg-primary")} style={{ width: `${pct}%` }} />
              </div>
            )}
            {l.projected !== null && <p className="text-xs text-muted-foreground">No ritmo atual: {fmt(l, l.projected)} no mês</p>}
          </li>
        );
      })}
    </ul>
  );
}
