import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2 } from "lucide-react";
import { OPS_PERIOD_LABEL, summarize, type OpsPeriod } from "@/domain/ops";
import { TASK_TYPE_LABEL } from "@/domain/tasks";
import { formatDate, formatDateTime } from "@/domain/shared/dates";
import { opsData } from "@/features/home/ops-queries";
import { cn } from "@/lib/utils";

const chip = (active: boolean) => cn("chip rounded-full border px-3 text-sm", active ? "border-brand bg-accent font-medium text-accent-foreground" : "bg-card hover:bg-muted");

/**
 * Painel operacional da gestão (prompt ERP 3.1, adaptado): o que está andando, o que
 * travou e quem está com o quê. Filtros por período e por pessoa ficam na URL.
 */
export async function OpsPanel({ period, personId }: { period: OpsPeriod; personId: string | null }) {
  const data = await opsData(period);
  const s = summarize(data.tasks, period, personId);
  const nowIso = new Date().toISOString();
  const qs = (p: OpsPeriod, who: string | null) => `?${new URLSearchParams({ ...(p !== "mes" ? { periodo: p } : {}), ...(who ? { pessoa: who } : {}) })}#operacional`;
  const person = personId ? s.people.find((p) => p.id === personId) : null;
  const kpis: [string, number, string, string][] = [
    ["Em andamento", s.kpis.doing, "", "/setores"],
    ["Aguardando aprovação", s.kpis.review, s.kpis.review ? "text-warning" : "", "/setores"],
    [`Concluídas (${OPS_PERIOD_LABEL[period].toLowerCase()})`, s.kpis.done, s.kpis.done ? "text-success" : "", "/producao"],
    ["Atrasadas", s.kpis.late, s.kpis.late ? "text-danger" : "", "/setores"],
    ["Sem responsável", s.kpis.unassigned, s.kpis.unassigned ? "text-warning" : "", "/setores"],
  ];

  return (
    <section id="operacional" aria-labelledby="operacional-titulo" className="grid scroll-mt-20 grid-cols-[minmax(0,1fr)] gap-4">
      <div className="grid gap-1">
        <h2 id="operacional-titulo" className="text-lg font-semibold">Operacional</h2>
        <p className="text-sm text-muted-foreground">{person ? `Demandas de ${person.name}.` : "A agência toda, agora."}</p>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
        <nav aria-label="Período" className="flex flex-wrap gap-1.5">
          {(Object.keys(OPS_PERIOD_LABEL) as OpsPeriod[]).map((p) => (
            <Link key={p} href={qs(p, personId)} aria-current={p === period ? "page" : undefined} className={chip(p === period)} scroll={false}>{OPS_PERIOD_LABEL[p]}</Link>
          ))}
        </nav>
        {s.people.length > 0 && (
          <nav aria-label="Pessoa" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            <Link href={qs(period, null)} aria-current={!personId ? "page" : undefined} className={cn(chip(!personId), "shrink-0")} scroll={false}>Todos</Link>
            {s.people.map((p) => (
              <Link key={p.id} href={qs(period, p.id)} aria-current={p.id === personId ? "page" : undefined} className={cn(chip(p.id === personId), "shrink-0 gap-1.5")} scroll={false}>
                {p.name.split(" ")[0]}
                {p.late > 0 && <span className="rounded-full bg-danger-soft px-1.5 text-xs font-semibold text-danger tabular" aria-label={`${p.late} atrasada(s)`}>{p.late}</span>}
              </Link>
            ))}
          </nav>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3 xl:grid-cols-5">
        {kpis.map(([label, value, tone, href]) => (
          <Link key={label} href={href} className="grid gap-1 bg-card p-4 hover:bg-muted/50 last:max-sm:col-span-2">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className={cn("font-heading text-3xl font-semibold tabular", tone)}>{value}</dd>
          </Link>
        ))}
      </dl>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-3">
          <h3 className="text-base font-semibold">Atrasadas e urgentes</h3>
          {s.urgent.length === 0 ? (
            <p className="flex items-center gap-2 rounded-xl border border-dashed bg-surface px-4 py-5 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-success" aria-hidden="true" /> Nada atrasado ou urgente agora.
            </p>
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {s.urgent.map((t) => {
                const late = Boolean(t.dueAt && t.dueAt < nowIso);
                return (
                  <li key={t.id}>
                    <Link href={`/tarefas/${t.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-4 py-3 hover:bg-muted/50">
                      <span className="truncate text-sm font-medium">{t.title}</span>
                      <span className={cn("text-xs tabular", late ? "font-medium text-danger" : "text-warning")}>
                        {late ? `Atrasada · ${formatDate(t.dueAt!)}` : t.priority === "urgente" ? "Urgente" : "Alta"}
                      </span>
                      <span className="col-span-2 truncate text-xs text-muted-foreground">{[t.clientName ?? "Interna", t.assigneeName ?? "Sem responsável"].join(" · ")}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <h3 className="mt-3 text-base font-semibold">Saúde dos clientes no mês</h3>
          {data.health.length === 0 ? (
            <p className="rounded-xl border border-dashed bg-surface px-4 py-5 text-sm text-muted-foreground">Nenhum cliente ativo com conteúdo contratado no mês.</p>
          ) : (
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
              {data.health.map((c) => {
                const pct = Math.round((c.delivered / c.contracted) * 100);
                return (
                  <li key={c.id}>
                    <Link href={`/clientes/${c.id}/midias`} className="grid grid-cols-[minmax(0,1fr)] gap-1.5 rounded-xl border bg-card px-3.5 py-3 hover:border-brand/60">
                      <span className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate font-medium">{c.name}</span>
                        <span className="shrink-0 text-xs tabular text-muted-foreground">{c.delivered}/{c.contracted}</span>
                      </span>
                      <span className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.name}: ${pct}% entregue`}>
                        <span className={cn("block h-full rounded-full", c.late ? "bg-danger" : pct >= 100 ? "bg-success" : "bg-brand")} style={{ width: `${pct}%` }} />
                      </span>
                      {c.late > 0 && <span className="inline-flex items-center gap-1 text-xs font-medium text-danger"><AlertTriangle className="size-3" aria-hidden="true" /> {c.late} atrasado{c.late > 1 ? "s" : ""}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-3">
          <h3 className="text-base font-semibold">Próximas reuniões</h3>
          {data.meetings.length === 0 ? (
            <p className="rounded-xl border border-dashed bg-surface px-4 py-5 text-sm text-muted-foreground">Nenhuma reunião nos próximos 7 dias.</p>
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {data.meetings.map((m) => (
                <li key={m.id}>
                  <Link href={m.href} className="grid gap-0.5 px-4 py-3 hover:bg-muted/50">
                    <span className="truncate text-sm font-medium">{m.title}</span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarClock className="size-3.5" aria-hidden="true" /> {formatDateTime(m.startsAt)}{m.clientName ? ` · ${m.clientName}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <h3 className="mt-3 text-base font-semibold">Entregas ({OPS_PERIOD_LABEL[period].toLowerCase()})</h3>
          {s.byType.length === 0 ? (
            <p className="rounded-xl border border-dashed bg-surface px-4 py-5 text-sm text-muted-foreground">Nenhuma demanda concluída no período.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-2">
              {s.byType.map((b) => (
                <li key={b.type} className="grid gap-0.5 rounded-xl border bg-card px-3.5 py-3">
                  <span className="text-xs text-muted-foreground">{TASK_TYPE_LABEL[b.type] ?? b.type}</span>
                  <span className="font-heading text-2xl font-semibold tabular">{b.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
