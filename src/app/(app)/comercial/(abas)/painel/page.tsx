import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { EmptyState } from "@/components/app/states";
import { buildPanel, isPeriod, periodRange, PERIODS, type PanelRow } from "@/domain/crm";
import { formatBRL } from "@/domain/shared/money";
import { listCrmPeople, listLeadsForPanel, listPipelines } from "@/features/crm/queries";
import { pickPipeline } from "@/features/crm/defaults";
import { PipelineSwitch } from "@/features/crm/components/pipeline-switch";
import { PeriodSwitch } from "@/features/crm/components/period-switch";

export const metadata: Metadata = { title: "Painel comercial" };

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

/** Painel comercial em tabelas: entradas, ganhos, conversão por origem e responsável, motivos de perda. */
export default async function PainelPage({ searchParams }: { searchParams: Promise<{ funil?: string; periodo?: string }> }) {
  const [, sp] = await Promise.all([requirePermission("crm.leads.read"), searchParams]);
  const [pipelines, all, people] = await Promise.all([listPipelines(), listLeadsForPanel(), listCrmPeople()]);
  const pipeline = pickPipeline(pipelines, sp.funil);
  if (!pipeline) return <EmptyState icon={BarChart3} title="Nenhum funil configurado" description="Crie um funil em Configurações › Funis comerciais." />;
  const period = isPeriod(sp.periodo) ? sp.periodo : "mes";
  const leads = all.filter((l) => l.pipelineId === pipeline.id);
  const p = buildPanel(leads, pipeline.stages, new Map(people.map((x) => [x.id, x.name])), periodRange(period));

  const totals: [string, string][] = [
    ["Leads que entraram", String(p.totals.leads)],
    ["Ganhos", String(p.totals.won)],
    ["Perdidos", String(p.totals.lost)],
    ["Conversão", pct(p.totals.conversion)],
    ["Vendido (mensal)", formatBRL(p.totals.wonCents)],
    ["Em aberto agora", `${p.totals.open} · ${formatBRL(p.totals.openCents)}`],
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <PipelineSwitch value={pipeline.id} pipelines={pipelines} />
        <PeriodSwitch value={period} />
      </div>
      {leads.length === 0 ? (
        <EmptyState icon={BarChart3} title="Sem dados ainda" description="O painel se monta sozinho conforme os leads entram e avançam no funil." />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3 lg:grid-cols-6">
            {totals.map(([k, v]) => (
              <div key={k} className="grid gap-0.5 bg-card px-4 py-3">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="text-lg font-semibold tabular">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="-mt-3 text-xs text-muted-foreground">{PERIODS[period]}. Conversão = ganhos ÷ (ganhos + perdidos) no período.</p>

          <section aria-labelledby="funil" className="grid gap-2">
            <h2 id="funil" className="text-base font-semibold">Funil agora</h2>
            <Table head={["Etapa", "Leads", "Valor estimado"]}>
              {p.funnel.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-3 py-2">{s.name}</td>
                  <td className="px-3 py-2 text-right tabular">{s.count}</td>
                  <td className="px-3 py-2 text-right tabular">{formatBRL(s.cents)}</td>
                </tr>
              ))}
            </Table>
          </section>

          <Breakdown id="origem" title="Por origem" rows={p.bySource} />
          <Breakdown id="resp" title="Por responsável" rows={p.byOwner} />

          <section aria-labelledby="motivos" className="grid gap-2">
            <h2 id="motivos" className="text-base font-semibold">Motivos de perda</h2>
            {p.lostReasons.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma perda no período.</p>
            ) : (
              <Table head={["Motivo", "Leads"]}>
                {p.lostReasons.map((r) => (
                  <tr key={r.reason} className="border-t">
                    <td className="px-3 py-2 break-words">{r.reason}</td>
                    <td className="px-3 py-2 text-right tabular">{r.count}</td>
                  </tr>
                ))}
              </Table>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Breakdown({ id, title, rows }: { id: string; title: string; rows: PanelRow[] }) {
  return (
    <section aria-labelledby={id} className="grid gap-2">
      <h2 id={id} className="text-base font-semibold">{title}</h2>
      <Table head={["", "Entraram", "Em aberto", "Ganhos", "Perdidos", "Conversão", "Vendido"]}>
        {rows.map((r) => (
          <tr key={r.key} className="border-t">
            <td className="px-3 py-2">{r.label}</td>
            <td className="px-3 py-2 text-right tabular">{r.leads}</td>
            <td className="px-3 py-2 text-right tabular">{r.open}</td>
            <td className="px-3 py-2 text-right tabular">{r.won}</td>
            <td className="px-3 py-2 text-right tabular">{r.lost}</td>
            <td className="px-3 py-2 text-right tabular">{pct(r.conversion)}</td>
            <td className="px-3 py-2 text-right tabular">{formatBRL(r.wonCents)}</td>
          </tr>
        ))}
      </Table>
    </section>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr className="bg-muted/50">
            {head.map((h, i) => (
              <th key={i} scope="col" className={i === 0 ? "px-3 py-2 text-left font-medium" : "px-3 py-2 text-right font-medium"}>
                {h || <span className="sr-only">Grupo</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
