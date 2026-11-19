import type { Metadata } from "next";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { GROUP_LABEL, adsQuery, parseAdsFilters } from "@/domain/ads/filters";
import { todayKey } from "@/domain/media";
import { getAdsReport, getModuleAccounts } from "@/features/ads/module-queries";
import { EfficiencyGrid, KpiGrid } from "@/features/ads/components/module/kpi";
import { SpendChart } from "@/features/ads/components/module/charts";
import { CampaignsTable } from "@/features/ads/components/module/campaigns-table";
import { FiltersRow, NoAccounts } from "./filters-row";

export const metadata: Metadata = { title: "Anúncios" };

/** Visão geral: indicadores comparados ao período anterior, investimento no tempo e as campanhas que mais gastaram. */
export default async function AnunciosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission(["ads.read"]);
  const today = todayKey(new Date());
  const filters = parseAdsFilters(await searchParams, today);
  const all = await getModuleAccounts(today);
  if (!all.length) return <NoAccounts canConnect={Boolean(user.permissions["ads.connect"])} />;
  const report = await getAdsReport(filters, today);
  const low = report.accounts.filter((a) => a.daysLeft !== null && a.daysLeft <= 3);
  const failing = report.accounts.filter((a) => a.syncError);
  const query = adsQuery(filters);

  return (
    <>
      <FiltersRow filters={filters} accounts={all} withGroup />
      {(low.length > 0 || failing.length > 0) && (
        <ul className="grid gap-1.5" aria-label="Atenção">
          {low.map((a) => (
            <li key={`l-${a.id}`} className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span><b>{a.clientName ?? a.name}</b>: saldo {a.daysLeft === 0 ? "acaba hoje" : `para cerca de ${a.daysLeft} ${a.daysLeft === 1 ? "dia" : "dias"}`} ({a.name}).</span>
            </li>
          ))}
          {failing.map((a) => (
            <li key={`e-${a.id}`} className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-sm">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <span><b>{a.clientName ?? a.name}</b>: {a.syncError}</span>
            </li>
          ))}
        </ul>
      )}
      <KpiGrid totals={report.totals} previous={report.previous} />
      <EfficiencyGrid totals={report.totals} />
      <SpendChart title={`Investimento por ${GROUP_LABEL[filters.group]}`} data={report.series} />
      <section aria-labelledby="top-campanhas" className="grid gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="top-campanhas" className="text-sm font-semibold">Campanhas com mais investimento</h2>
          <Link href={`/anuncios/campanhas?${query}`} className="text-sm font-medium text-primary hover:underline">Ver todas as campanhas</Link>
        </div>
        <CampaignsTable rows={report.campaigns.slice(0, 5)} label="Campanhas com mais investimento" empty="Nenhuma campanha no ar nem com gasto nestes filtros." />
      </section>
    </>
  );
}
