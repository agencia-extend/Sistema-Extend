"use client";

import dynamic from "next/dynamic";
import { formatBRL } from "@/domain/shared/money";

const Loading = () => <div className="h-60 animate-pulse rounded-lg bg-muted/40" aria-hidden="true" />;
// Recharts só baixa na tela que tem gráfico, depois do conteúdo.
const SpendBars = dynamic(() => import("./charts-plot").then((m) => m.SpendBars), { ssr: false, loading: Loading });

/** Investimento no período, com a tabela alternativa para leitores de tela e para quem prefere números. */
export function SpendChart({ title, data }: { title: string; data: { period: string; spend: number; results: number; clicks: number }[] }) {
  return (
    <figure className="grid gap-3 rounded-xl border bg-surface p-4">
      <figcaption className="grid gap-1">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-muted-foreground">Valores informados pela Meta.</span>
      </figcaption>
      <div aria-hidden="true"><SpendBars data={data} /></div>
      <details className="text-sm">
        <summary className="cursor-pointer text-xs text-primary">Ver dados em tabela</summary>
        <div className="mt-2 max-h-72 overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th scope="col" className="py-1 pr-3 font-medium">Período</th>
                <th scope="col" className="py-1 pr-3 text-right font-medium">Investimento</th>
                <th scope="col" className="py-1 pr-3 text-right font-medium">Cliques no link</th>
                <th scope="col" className="py-1 text-right font-medium">Resultados</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.period} className="border-b last:border-0">
                  <td className="py-1 pr-3">{r.period}</td>
                  <td className="py-1 pr-3 text-right tabular-nums">{formatBRL(r.spend)}</td>
                  <td className="py-1 pr-3 text-right tabular-nums">{r.clicks.toLocaleString("pt-BR")}</td>
                  <td className="py-1 text-right tabular-nums">{r.results.toLocaleString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
