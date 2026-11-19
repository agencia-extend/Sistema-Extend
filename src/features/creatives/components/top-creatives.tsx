import Link from "next/link";
import { Trophy } from "lucide-react";
import { CREATIVE_FORMAT_LABEL, type CreativeFormat } from "@/domain/creatives";
import { costPerResult, creativeCode, creativeResults, type CreativeTotals } from "@/domain/creatives/performance";
import { formatBRL } from "@/domain/shared/money";

type Item = { id: string; taskId: string; angle: string; clientName: string; format: CreativeFormat; ref: number; totals: CreativeTotals };

const what = (t: CreativeTotals, n: number) =>
  t.leads ? (n === 1 ? "lead" : "leads") : t.messages ? (n === 1 ? "conversa" : "conversas") : n === 1 ? "compra" : "compras";

/** Top criativos do período (RF-BIB-04): os que trouxeram mais resultados, com o custo de cada. */
export function TopCreatives({ items, periodLabel }: { items: Item[]; periodLabel: string }) {
  return (
    <section aria-labelledby="top-criativos" className="grid gap-2 rounded-xl border bg-card p-3 sm:p-4">
      <h2 id="top-criativos" className="flex items-center gap-2 text-sm font-semibold">
        <Trophy className="size-4 text-brand" aria-hidden="true" /> Top criativos · {periodLabel}
      </h2>
      <ol className="grid gap-2 sm:grid-cols-3">
        {items.map((i, n) => {
          const r = creativeResults(i.totals);
          const cpr = costPerResult(i.totals);
          return (
            <li key={i.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 rounded-lg bg-muted/50 px-3 py-2">
              <span className="row-span-3 text-lg font-semibold text-muted-foreground tabular-nums">{n + 1}º</span>
              <Link href={`/criativos/${i.taskId}`} className="truncate text-sm font-medium hover:underline">{i.angle}</Link>
              <span className="truncate text-xs text-muted-foreground">{i.clientName} · {CREATIVE_FORMAT_LABEL[i.format]} · {creativeCode(i.ref)}</span>
              <span className="text-xs tabular-nums">
                <span className="font-medium">{r.toLocaleString("pt-BR")} {what(i.totals, r)}</span>
                {cpr !== null && ` · ${formatBRL(cpr)} cada`} · {formatBRL(i.totals.spendCents)} investidos
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
