"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { formatBRL } from "@/domain/shared/money";

// Parte pesada (Recharts), carregada sob demanda por charts.tsx.

const compactBRL = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 }).format(cents / 100);

function TooltipBox({ active, payload, label }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as { spend: number; results: number };
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      <p className="flex justify-between gap-4 text-muted-foreground">Investimento <span className="font-medium text-foreground tabular-nums">{formatBRL(d.spend)}</span></p>
      <p className="flex justify-between gap-4 text-muted-foreground">Resultados <span className="font-medium text-foreground tabular-nums">{d.results.toLocaleString("pt-BR")}</span></p>
    </div>
  );
}

/** Barras do investimento por dia, semana ou mês. Respeita "reduzir movimento". */
export function SpendBars({ data }: { data: { period: string; spend: number; results: number }[] }) {
  const motion = typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis dataKey="period" tickLine={false} axisLine={{ stroke: "var(--chart-axis)" }} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} minTickGap={8} />
        <YAxis tickLine={false} axisLine={false} width={64} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} tickFormatter={(v: number) => compactBRL(v)} />
        <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.5 }} content={(p) => <TooltipBox {...(p as TooltipContentProps<number, string>)} />} />
        <Bar dataKey="spend" name="Investimento" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={motion} animationDuration={500} />
      </BarChart>
    </ResponsiveContainer>
  );
}
