import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageOff, Megaphone } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { EmptyState } from "@/components/app/states";
import { buttonVariants } from "@/components/ui/button";
import { PERIOD_LABEL, RESULT_LABEL, parsePeriod, periodRange, type Period } from "@/domain/ads";
import { todayKey } from "@/domain/media";
import { formatBRL } from "@/domain/shared/money";
import { getClient } from "@/features/clients/queries";
import { getClientAds, getClientGoal } from "@/features/ads/queries";
import { PanelTable, StatusDot } from "@/features/ads/components/panel-table";
import { SyncButton } from "@/features/ads/components/sync-button";
import { ReportButton } from "@/features/ads/components/report-button";
import { GoalDialog } from "@/features/ads/components/goal-dialog";
import { GoalProgress } from "@/features/ads/components/goal-progress";
import { getAlertLimits, getClientOpenAlerts } from "@/features/alerts/queries";
import { AlertList } from "@/features/alerts/components/alert-list";
import { LimitsDialog } from "@/features/alerts/components/limits-dialog";
import { limitsSummary } from "@/domain/ads/alerts";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Target } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Anúncios do cliente" };
export const maxDuration = 60;

const int = new Intl.NumberFormat("pt-BR");

/** RF-ADS-07: o que está no ar (ou rodou no período) nas contas do cliente, com miniatura e números. */
export default async function AnunciosPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ periodo?: string }> }) {
  const user = await requirePermission(["ads.read"]);
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const period = parsePeriod(sp.periodo);
  const today = todayKey(new Date());
  const [client, data, goal, alerts, limits] = await Promise.all([
    getClient(id), getClientAds(id, periodRange(period, today)), getClientGoal(id, today), getClientOpenAlerts(id, user), getAlertLimits(id),
  ]);
  const canGoal = Boolean(user.permissions["optimization.manage"]);
  const month = `${today.slice(0, 7)}-01`;
  const monthName = new Date(`${month}T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  if (!client) notFound();

  if (!data.accounts.length)
    return (
      <EmptyState
        icon={Megaphone}
        title="Nenhuma conta de anúncio ligada a este cliente"
        description="Ligue a conta do cliente em Configurações › Integrações ou conecte o Facebook dele na aba Tráfego. Os números chegam na sincronização seguinte."
        action={<Link href={`/clientes/${id}/trafego#facebook`} className={buttonVariants({ variant: "outline" })}>Abrir a aba Tráfego</Link>}
      />
    );

  return (
    <div className="grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Período" className="flex flex-wrap gap-1 text-sm">
          {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
            <Link key={p} href={`/clientes/${id}/anuncios?periodo=${p}`} aria-current={p === period ? "page" : undefined}
              className={cn("rounded-md px-3 py-1.5", p === period ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
              {PERIOD_LABEL[p]}
            </Link>
          ))}
        </nav>
        {user.permissions["ads.manage"] && (
          <div className="flex flex-wrap gap-2">
            <SyncButton clientId={id} />
            <ReportButton clientId={id} period={period} />
          </div>
        )}
      </div>

      <section id="alertas" aria-labelledby="alertas-h" className="grid scroll-mt-20 gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="alertas-h" className="text-base font-semibold">Alertas em aberto</h2>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/trafego/alertas" className="text-sm text-primary hover:underline">Ver todos os alertas</Link>
            {user.permissions["ads.manage"] && (
              <LimitsDialog clientId={id} clientName={client.name} limits={limits.effective} custom={limits.custom}
                trigger={<Button size="sm" variant="outline"><SlidersHorizontal aria-hidden="true" /> Limites dos alertas</Button>} />
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {limits.custom ? "Limites do cliente" : "Padrão da agência"}: {limitsSummary(limits.effective, formatBRL)}.
        </p>
        {alerts.length > 0 ? <AlertList rows={alerts} showClient={false} /> : <p className="text-sm text-muted-foreground">Nenhum alerta em aberto para este cliente.</p>}
      </section>

      <section id="metas" aria-labelledby="metas-h" className="grid scroll-mt-20 gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="metas-h" className="text-base font-semibold first-letter:uppercase">Metas de {monthName}</h2>
          {canGoal && (
            <GoalDialog clientId={id} month={month} monthLabel={monthName} goal={goal.goal}
              trigger={<Button size="sm" variant="outline"><Target aria-hidden="true" /> {goal.goal ? "Editar meta" : "Definir meta"}</Button>} />
          )}
        </div>
        {goal.goal ? (
          <GoalProgress goal={goal.goal} actual={goal.actual} today={today} />
        ) : (
          <p className="text-sm text-muted-foreground">{canGoal ? "Sem meta para este mês. Defina o que foi combinado com o cliente (resultados, investimento, custo máximo) para acompanhar o ritmo." : "Sem meta definida para este mês."}</p>
        )}
        {goal.goal?.notes && <p className="text-sm text-muted-foreground break-words">{goal.goal.notes}</p>}
      </section>

      <PanelTable accounts={data.accounts} showClient={false} />

      <section aria-labelledby="anuncios" className="grid gap-3">
        <h2 id="anuncios" className="text-base font-semibold">Anúncios</h2>
        {data.ads.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum anúncio no ar nem com gasto em {PERIOD_LABEL[period].toLowerCase()}.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.ads.map((a) => {
              const label = RESULT_LABEL[a.kind];
              return (
                <li key={a.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 rounded-xl border bg-card p-3">
                  {a.thumbnailUrl ? (
                    // Miniatura servida pela Meta (endereço assinado e temporário).
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.thumbnailUrl} alt="" width={72} height={72} loading="lazy" className="size-18 rounded-lg border object-cover" />
                  ) : (
                    <span className="grid size-18 place-items-center rounded-lg border bg-muted text-muted-foreground"><ImageOff className="size-5" aria-hidden="true" /></span>
                  )}
                  <div className="grid min-w-0 content-start gap-1">
                    <p className="text-sm font-medium break-words">{a.name}</p>
                    <StatusDot status={a.status} />
                    {a.campaignName && <p className="truncate text-xs text-muted-foreground" title={a.campaignName}>{a.campaignName}</p>}
                    <p className="text-xs tabular">
                      {formatBRL(a.totals.spend_cents)} · {a.kind === "impressions" ? `${int.format(a.totals.impressions)} impressões` : `${int.format(a.kpis.results)} ${a.kpis.results === 1 ? label.one : label.many}`}
                      {a.kpis.costPerResultCents !== null && a.kind !== "impressions" ? ` · ${formatBRL(a.kpis.costPerResultCents)} cada` : ""}
                    </p>
                    {a.reviewFeedback && <p className="text-xs break-words text-danger">{a.reviewFeedback}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
