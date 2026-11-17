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
import { getClientAds } from "@/features/ads/queries";
import { PanelTable, StatusDot } from "@/features/ads/components/panel-table";
import { SyncButton } from "@/features/ads/components/sync-button";
import { ReportButton } from "@/features/ads/components/report-button";
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
  const [client, data] = await Promise.all([getClient(id), getClientAds(id, periodRange(period, today))]);
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
