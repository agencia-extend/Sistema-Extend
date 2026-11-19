import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/dal";
import { adsQuery, parseAdsFilters } from "@/domain/ads/filters";
import { todayKey } from "@/domain/media";
import { getClientsSummary, getModuleAccounts } from "@/features/ads/module-queries";
import { ClientsTable } from "@/features/ads/components/module/clients-table";
import { FiltersRow, NoAccounts } from "../filters-row";

export const metadata: Metadata = { title: "Anúncios por cliente" };

/** Um resumo por cliente: gasto e variação, resultados, custo, saldo, campanhas no ar e alertas abertos. */
export default async function AnunciosClientesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission(["ads.read"]);
  const today = todayKey(new Date());
  const filters = parseAdsFilters(await searchParams, today);
  const all = await getModuleAccounts(today);
  if (!all.length) return <NoAccounts canConnect={Boolean(user.permissions["ads.connect"])} />;
  const rows = await getClientsSummary(filters, today);
  return (
    <>
      <FiltersRow filters={filters} accounts={all} />
      <ClientsTable rows={rows} query={adsQuery({ ...filters, clientId: undefined, accountId: undefined })} />
    </>
  );
}
