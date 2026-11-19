import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/dal";
import { parseAdsFilters } from "@/domain/ads/filters";
import { todayKey } from "@/domain/media";
import { getModuleAccounts, getModuleAdSets } from "@/features/ads/module-queries";
import { AdSetsTable } from "@/features/ads/components/module/adsets-table";
import { FiltersRow, NoAccounts } from "../filters-row";

export const metadata: Metadata = { title: "Conjuntos" };

/** Conjuntos de anúncios no ar ou com gasto no período, com orçamento e números. */
export default async function AnunciosConjuntosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission(["ads.read"]);
  const today = todayKey(new Date());
  const filters = parseAdsFilters(await searchParams, today);
  const all = await getModuleAccounts(today);
  if (!all.length) return <NoAccounts canConnect={Boolean(user.permissions["ads.connect"])} />;
  const { sets, hasData } = await getModuleAdSets(filters, today);
  return (
    <>
      <FiltersRow filters={filters} accounts={all} />
      {!hasData && (
        <p role="status" className="rounded-md border border-info/30 bg-info-soft px-3 py-2 text-sm">
          Os números por conjunto chegam na próxima sincronização (a cada 3 horas, ou agora em Sincronizar agora). Até lá, os conjuntos aparecem sem gasto.
        </p>
      )}
      <AdSetsTable rows={sets} />
    </>
  );
}
