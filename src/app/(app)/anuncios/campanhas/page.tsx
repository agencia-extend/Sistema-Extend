import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/dal";
import { parseAdsFilters } from "@/domain/ads/filters";
import { todayKey } from "@/domain/media";
import { formatBRL } from "@/domain/shared/money";
import { getAdsReport, getModuleAccounts } from "@/features/ads/module-queries";
import { CampaignsTable } from "@/features/ads/components/module/campaigns-table";
import { FiltersRow, NoAccounts } from "../filters-row";

export const metadata: Metadata = { title: "Campanhas" };

/** Todas as campanhas no ar ou com gasto no período, com ajuste pelo sistema. */
export default async function AnunciosCampanhasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission(["ads.read"]);
  const today = todayKey(new Date());
  const filters = parseAdsFilters(await searchParams, today);
  const all = await getModuleAccounts(today);
  if (!all.length) return <NoAccounts canConnect={Boolean(user.permissions["ads.connect"])} />;
  const { campaigns } = await getAdsReport(filters, today);
  const spend = campaigns.reduce((s, c) => s + c.totals.spend_cents, 0);
  return (
    <>
      <FiltersRow filters={filters} accounts={all} />
      <p className="text-sm text-muted-foreground">
        {campaigns.length} {campaigns.length === 1 ? "campanha" : "campanhas"} · {formatBRL(spend)} investidos
      </p>
      <CampaignsTable rows={campaigns} label="Campanhas" empty="Nenhuma campanha no ar nem com gasto nestes filtros." showClient={!filters.clientId} />
    </>
  );
}
