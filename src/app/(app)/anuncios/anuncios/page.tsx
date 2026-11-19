import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/dal";
import { parseAdsFilters } from "@/domain/ads/filters";
import { todayKey } from "@/domain/media";
import { getModuleAccounts, getModuleAds } from "@/features/ads/module-queries";
import { AdsTable } from "@/features/ads/components/module/ads-table";
import { FiltersRow, NoAccounts } from "../filters-row";

export const metadata: Metadata = { title: "Anúncios no ar" };

/** Anúncios no ar, com gasto no período ou reprovados, do que mais gastou para o que menos gastou. */
export default async function AnunciosListaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission(["ads.read"]);
  const today = todayKey(new Date());
  const filters = parseAdsFilters(await searchParams, today);
  const all = await getModuleAccounts(today);
  if (!all.length) return <NoAccounts canConnect={Boolean(user.permissions["ads.connect"])} />;
  const ads = await getModuleAds(filters, today);
  return (
    <>
      <FiltersRow filters={filters} accounts={all} />
      <AdsTable rows={ads} canRequest={Boolean(user.permissions["creatives.request.create"])} />
    </>
  );
}
