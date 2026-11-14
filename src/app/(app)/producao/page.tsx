import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck, Download } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { productionData } from "@/features/media/queries";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addMonths, todayKey } from "@/domain/media";
import { DRILL_LABEL, buildReport, drillTasks, parseDrill, type DrillKind } from "@/domain/media/report";
import { DrillList } from "./drill-list";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Controle geral" };

const isDay = (v?: string) => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));
const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

/** Atalhos de período. "Este mês" e "Mês passado" são do calendário: é assim que a gestão pede o relatório. */
function presets(today: string) {
  const first = `${today.slice(0, 8)}01`;
  const prevFirst = addMonths(first, -1);
  const prevLast = new Date(Date.UTC(Number(first.slice(0, 4)), Number(first.slice(5, 7)) - 1, 0)).toISOString().slice(0, 10);
  const back = (n: number) => new Date(new Date(`${today}T12:00:00Z`).getTime() - n * 86_400_000).toISOString().slice(0, 10);
  return [
    { label: "Este mês", de: first, ate: today },
    { label: "Mês passado", de: prevFirst, ate: prevLast },
    { label: "Últimos 7 dias", de: back(6), ate: today },
    { label: "Últimos 90 dias", de: back(89), ate: today },
  ];
}

/** Controle Geral: produção por pessoa no período, entregue × contratado por cliente, gargalos e atrasos. */
export default async function ProducaoPage({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string; ver?: string }> }) {
  await requirePermission("dashboards.read");
  const sp = await searchParams;
  const today = todayKey();
  const list = presets(today);
  let de = isDay(sp.de) ? sp.de! : list[0].de;
  let ate = isDay(sp.ate) ? sp.ate! : list[0].ate;
  if (de > ate) [de, ate] = [ate, de];

  const data = await productionData(de, ate);
  const r = buildReport(data.finished, data.open, data.months, data.slots, { from: de, to: ate });
  const maxStep = Math.max(1, ...r.steps.map((s) => s.count));
  const totals: [string, number, string, DrillKind][] = [
    ["Finalizados no período", r.totals.finished, "", "finalizados"],
    ["Em produção agora", r.totals.open, "", "abertos"],
    ["Atrasados", r.totals.late, r.totals.late ? "text-danger" : "", "atrasados"],
    ["Alterações pedidas", r.totals.rework, r.totals.rework ? "text-warning" : "", "alteracoes"],
  ];
  // Cada número abre a lista que o compõe (parâmetro "ver").
  const base = `/producao?de=${de}&ate=${ate}`;
  const see = (v: string) => `${base}&ver=${encodeURIComponent(v)}#lista`;
  const drill = parseDrill(sp.ver);
  const drillRows = drill ? drillTasks(drill, data.finished, data.open, { from: de, to: ate }) : [];
  const drillTitle = !drill ? "" : drill.kind === "etapa" ? `Em produção na etapa ${drill.step}` : DRILL_LABEL[drill.kind] + (drill.personId ? ` · ${r.people.find((p) => p.id === drill.personId)?.name ?? ""}` : "");
  const cell = (n: number, v: string, cls?: string) => (n > 0 ? <Link href={see(v)} scroll={false} className={cn("underline-offset-2 hover:underline", cls)}>{n}</Link> : <span className={cls}>{n}</span>);

  return (
    <>
      <PageHeader
        title="Controle geral"
        description="Quanto cada pessoa produziu, o que cada cliente já recebeu no mês dele e onde a produção está parada."
        actions={
          <a href={`/producao/exportar?de=${de}&ate=${ate}`} className={buttonVariants({ variant: "outline" })} download>
            <Download aria-hidden="true" /> Baixar CSV
          </a>
        }
      />
      <PageBody className="grid grid-cols-[minmax(0,1fr)] gap-6">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:flex lg:flex-wrap lg:items-end lg:gap-x-6">
          <nav aria-label="Período" className="flex min-w-0 flex-wrap gap-1.5">
            {list.map((p) => {
              const active = p.de === de && p.ate === ate;
              return (
                <Link key={p.label} href={`?de=${p.de}&ate=${p.ate}`} aria-current={active ? "page" : undefined}
                  className={cn("chip rounded-full border px-3 text-sm", active ? "border-brand bg-accent font-medium text-accent-foreground" : "hover:bg-muted")}>
                  {p.label}
                </Link>
              );
            })}
          </nav>
          <form method="get" className="grid min-w-0 grid-cols-2 items-end gap-2 sm:flex sm:flex-wrap">
            <div className="grid gap-1">
              <Label htmlFor="de" className="text-xs text-muted-foreground">De</Label>
              <Input id="de" name="de" type="date" defaultValue={de} max={today} className="w-full sm:w-40" />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="ate" className="text-xs text-muted-foreground">Até</Label>
              <Input id="ate" name="ate" type="date" defaultValue={ate} max={today} className="w-full sm:w-40" />
            </div>
            <Button type="submit" variant="outline" className="col-span-2 sm:col-auto">Aplicar período</Button>
          </form>
        </div>

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4">
          {totals.map(([l, v, c, k]) => (
            <div key={l} className="grid gap-1 bg-card p-4">
              <dt className="text-sm text-muted-foreground">{l}</dt>
              <dd className={cn("font-heading text-3xl font-semibold tabular", c)}>{v > 0 ? <Link href={see(k)} scroll={false} aria-label={`${l}: ${v}. Ver a lista`} className="underline-offset-4 hover:underline">{v}</Link> : v}</dd>
            </div>
          ))}
        </dl>

        {drill && <DrillList title={drillTitle} tasks={drillRows} closeHref={base} />}

        <section aria-labelledby="pessoas" className="grid gap-3">
          <div>
            <h2 id="pessoas" className="text-base font-semibold">Produção por pessoa</h2>
            <p className="text-sm text-muted-foreground">Conteúdos finalizados de {br(de)} a {br(ate)}, por quem editou ou criou.</p>
          </div>
          {r.people.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="Ninguém com conteúdo neste período"
              description="A produção aparece quando o conteúdo tem alguém escolhido para editar ou criar (no Controle de Mídias do cliente) e chega à etapa final."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 text-left font-medium">Pessoa</th>
                    {["Finalizados", "Vídeos", "Artes", "Em aberto", "Atrasados", "Alterações", "Gravações"].map((h) => (
                      <th key={h} scope="col" className="px-3 py-2.5 text-right font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y tabular">
                  {r.people.map((p) => (
                    <tr key={p.id}>
                      <th scope="row" className="px-4 py-2.5 text-left font-medium">{p.name}</th>
                      <td className="px-3 py-2.5 text-right text-base font-semibold">{cell(p.finished, `pessoa:${p.id}:finalizados`)}</td>
                      <td className="px-3 py-2.5 text-right">{cell(p.video, `pessoa:${p.id}:videos`)}</td>
                      <td className="px-3 py-2.5 text-right">{cell(p.design, `pessoa:${p.id}:artes`)}</td>
                      <td className="px-3 py-2.5 text-right">{cell(p.open, `pessoa:${p.id}:abertos`)}</td>
                      <td className="px-3 py-2.5 text-right">{cell(p.late, `pessoa:${p.id}:atrasados`, p.late > 0 ? "font-medium text-danger" : undefined)}</td>
                      <td className="px-3 py-2.5 text-right">{cell(p.rework, `pessoa:${p.id}:alteracoes`, p.rework > 0 ? "text-warning" : undefined)}</td>
                      <td className="px-3 py-2.5 text-right">{cell(p.recorded, `pessoa:${p.id}:gravacoes`)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <section aria-labelledby="clientes" className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-3">
            <div>
              <h2 id="clientes" className="text-base font-semibold">Entregue × contratado</h2>
              <p className="text-sm text-muted-foreground">No mês atual de cada cliente. Quem está mais atrás aparece primeiro.</p>
            </div>
            {r.clients.length === 0 ? (
              <p className="rounded-xl border border-dashed bg-surface px-4 py-6 text-sm text-muted-foreground">Nenhum cliente ativo com conteúdo contratado neste mês.</p>
            ) : (
              <ul className="divide-y rounded-xl border bg-card">
                {r.clients.map((c) => {
                  const pct = Math.round((c.delivered / c.contracted) * 100);
                  return (
                    <li key={c.id}>
                      <Link href={`/clientes/${c.id}/midias`} className="grid grid-cols-[minmax(0,1fr)] gap-1.5 px-4 py-3 hover:bg-muted/50">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="min-w-0 truncate text-sm font-medium">{c.name}</span>
                          <span className="shrink-0 text-sm tabular"><span className="font-semibold">{c.delivered}</span> de {c.contracted}</span>
                        </span>
                        <span className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${pct}% entregue`}>
                          <span className={cn("block h-full rounded-full", pct >= 100 ? "bg-success" : "bg-brand")} style={{ width: `${pct}%` }} />
                        </span>
                        <span className="flex justify-between gap-3 text-xs text-muted-foreground tabular">
                          <span>Mês {c.number} ({c.period})</span>
                          {c.late > 0 && <span className="font-medium text-danger">{c.late} atrasado{c.late > 1 ? "s" : ""}</span>}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="gargalos" className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-3">
            <div>
              <h2 id="gargalos" className="text-base font-semibold">Onde a produção está</h2>
              <p className="text-sm text-muted-foreground">Conteúdos em aberto por etapa, agora.</p>
            </div>
            {r.steps.length === 0 ? (
              <p className="rounded-xl border border-dashed bg-surface px-4 py-6 text-sm text-muted-foreground">Nada em produção no momento.</p>
            ) : (
              <ul className="grid gap-2.5 rounded-xl border bg-card p-4">
                {r.steps.map((s) => (
                  <li key={s.name} className="grid gap-1">
                    <span className="flex justify-between gap-3 text-sm">
                      <span className="truncate">{s.name}</span>
                      <Link href={see(`etapa:${s.name}`)} scroll={false} aria-label={`${s.count} em ${s.name}. Ver a lista`} className="font-semibold tabular underline-offset-2 hover:underline">{s.count}</Link>
                    </span>
                    <span className="h-1.5 rounded-full bg-muted" aria-hidden="true">
                      <span className="block h-full rounded-full" style={{ width: `${(s.count / maxStep) * 100}%`, background: s.color }} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </PageBody>
    </>
  );
}
