import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, CheckCircle2, ChevronRight, Circle, CircleDot, FileText, Target } from "lucide-react";
import { requirePortal } from "@/lib/auth/dal";
import { portalHome } from "@/features/portal/queries";
import { FORMAT_LABEL } from "@/domain/media";
import { MILESTONE_LABEL, milestoneState, monthProgress, monthlyQty, shortDay } from "@/domain/portal";
import { todaySP } from "@/domain/proposals";
import { formatDate } from "@/domain/shared/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Início" };

/** Visão geral do projeto (RF-ACL-02): o mês, o que aguarda o cliente, os próximos posts e os marcos. */
export default async function PortalHomePage() {
  const { clientId } = await requirePortal();
  const h = await portalHome(clientId);
  const today = todaySP();
  const progress = h.month ? monthProgress(h.month.services) : null;

  return (
    <>
      <header className="grid gap-1">
        <h1 className="font-heading text-2xl font-semibold text-balance break-words sm:text-3xl">{h.client.name}</h1>
        <p className="text-sm text-muted-foreground">
          {h.owner?.name ? `Seu contato na Extend: ${h.owner.name}` : "Acompanhe aqui o andamento do seu projeto com a Agência Extend."}
        </p>
      </header>

      {h.pending_approvals > 0 && (
        <Link href="/portal/aprovacoes" className="flex items-center gap-3 rounded-xl border border-brand/40 bg-brand/5 p-4 hover:bg-brand/10">
          <CircleDot className="size-5 shrink-0 text-brand" aria-hidden="true" />
          <span className="grid min-w-0 flex-1">
            <span className="font-semibold">{h.pending_approvals === 1 ? "1 conteúdo aguardando sua aprovação" : `${h.pending_approvals} conteúdos aguardando sua aprovação`}</span>
            <span className="text-sm text-muted-foreground">Veja, aprove ou peça alteração. A equipe é avisada na hora.</span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Link>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="grid min-w-0 content-start gap-6">
          <section aria-labelledby="mes" className="grid gap-4 rounded-xl border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="mes" className="text-base font-semibold">{h.month ? `Mês ${h.month.number} do projeto` : "Este mês"}</h2>
              {h.month && <span className="text-sm text-muted-foreground tabular">{shortDay(h.month.starts_on)} a {shortDay(h.month.ends_on)}</span>}
            </div>
            {!progress || progress.total === 0 ? (
              <p className="text-sm text-muted-foreground">As entregas do mês aparecem aqui assim que a equipe planejar o mês.</p>
            ) : (
              <>
                <p className="flex items-baseline gap-2">
                  <span className="font-heading text-4xl font-semibold tabular">{progress.percent}%</span>
                  <span className="text-sm text-muted-foreground tabular">entregue ({progress.done} de {progress.total})</span>
                </p>
                <ul className="grid gap-3">
                  {h.month!.services.map((s) => {
                    const pct = s.total ? Math.round((Math.min(s.done, s.total) / s.total) * 100) : 0;
                    return (
                      <li key={s.name} className="grid gap-1">
                        <div className="flex justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate">{s.name}</span>
                          <span className="shrink-0 text-muted-foreground tabular">{s.done}/{s.total}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={s.name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                          <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>

          <section aria-labelledby="proximos" className="grid gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 id="proximos" className="text-base font-semibold">Próximos posts</h2>
              <Link href="/portal/cronograma" className="text-sm font-medium text-primary hover:underline">Ver cronograma</Link>
            </div>
            {h.next_posts.length === 0 ? (
              <p className="rounded-xl border border-dashed bg-surface p-4 text-sm text-muted-foreground">Nenhum post programado para os próximos dias.</p>
            ) : (
              <ul className="divide-y rounded-xl border bg-card">
                {h.next_posts.map((p, i) => (
                  <li key={i} className="flex items-center gap-3 px-4 py-3">
                    <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-sm">{p.title}</span>
                    {p.format && <span className="hidden text-xs text-muted-foreground sm:inline">{FORMAT_LABEL[p.format]}</span>}
                    <span className="shrink-0 text-sm tabular">{shortDay(p.post_on)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="grid min-w-0 content-start gap-6">
          {h.milestones.length > 0 && (
            <section aria-labelledby="marcos" className="grid gap-3">
              <h2 id="marcos" className="text-base font-semibold">Etapas do projeto</h2>
              <ol className="grid gap-0 rounded-xl border bg-card p-4">
                {h.milestones.map((m, i) => {
                  const st = milestoneState(m, today);
                  const Icon = st === "feito" ? CheckCircle2 : st === "atrasado" ? CircleDot : Circle;
                  return (
                    <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                      {i < h.milestones.length - 1 && <span className="absolute top-6 bottom-0 left-[9px] w-px bg-border" aria-hidden="true" />}
                      <Icon className={cn("size-5 shrink-0", st === "feito" ? "text-success" : st === "atrasado" ? "text-brand" : "text-muted-foreground")} aria-hidden="true" />
                      <span className="grid min-w-0 gap-0.5">
                        <span className="text-sm font-medium break-words">{m.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {MILESTONE_LABEL[st]}
                          {st === "feito" && m.done_at ? ` em ${formatDate(m.done_at)}` : m.due_on && st !== "feito" ? ` · previsto para ${shortDay(m.due_on)}` : ""}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          <section aria-labelledby="servicos" className="grid gap-3">
            <h2 id="servicos" className="text-base font-semibold">Serviços contratados</h2>
            {h.services.length === 0 ? (
              <p className="rounded-xl border border-dashed bg-surface p-4 text-sm text-muted-foreground">Os serviços aparecem aqui quando o contrato estiver registrado.</p>
            ) : (
              <ul className="divide-y rounded-xl border bg-card">
                {h.services.map((s) => (
                  <li key={s.name} className="flex justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="min-w-0 break-words">{s.name}</span>
                    {monthlyQty(s.qty) && <span className="shrink-0 text-muted-foreground tabular">{monthlyQty(s.qty)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <ul className="grid gap-2">
            <li>
              <Link href="/portal/relatorios" className="flex items-center gap-3 rounded-xl border bg-card p-3 hover:bg-muted/50">
                <FileText className="size-5 shrink-0 text-brand" aria-hidden="true" />
                <span className="grid min-w-0 text-sm">
                  <span className="font-medium">Relatórios</span>
                  <span className="truncate text-xs text-muted-foreground">{h.latest_report ? `Último: ${h.latest_report.name}` : "Nenhum relatório ainda"}</span>
                </span>
              </Link>
            </li>
            <li>
              <Link href="/portal/estrategia" className="flex items-center gap-3 rounded-xl border bg-card p-3 hover:bg-muted/50">
                <Target className="size-5 shrink-0 text-brand" aria-hidden="true" />
                <span className="grid min-w-0 text-sm">
                  <span className="font-medium">Estratégia</span>
                  <span className="truncate text-xs text-muted-foreground">{h.strategy_at ? `Atualizada em ${formatDate(h.strategy_at)}` : "Ainda não publicada"}</span>
                </span>
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}
