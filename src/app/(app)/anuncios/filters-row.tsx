import { Suspense } from "react";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/app/states";
import { buttonVariants } from "@/components/ui/button";
import { rangeLabel, type AdsFilters } from "@/domain/ads/filters";
import { AdsFilterBar } from "@/features/ads/components/module/ads-filter-bar";
import type { ModuleAccount } from "@/features/ads/module-queries";

/** Barra de filtros com as opções das contas que a pessoa vê, e o período por extenso. */
export function FiltersRow({ filters, accounts, withGroup = false }: { filters: AdsFilters; accounts: ModuleAccount[]; withGroup?: boolean }) {
  const clients = [...new Map(accounts.filter((a) => a.clientId).map((a) => [a.clientId!, a.clientName ?? "Cliente"])).entries()].map(([id, name]) => ({ id, name }));
  return (
    <div className="grid gap-2">
      <Suspense>
        <AdsFilterBar filters={filters} clients={clients} accounts={accounts.map((a) => ({ id: a.id, name: a.name, clientId: a.clientId }))} withGroup={withGroup} />
      </Suspense>
      <p className="text-xs text-muted-foreground">
        {rangeLabel(filters.from, filters.to)} · comparado a {rangeLabel(filters.prevFrom, filters.prevTo)}
      </p>
    </div>
  );
}

export function NoAccounts({ canConnect }: { canConnect: boolean }) {
  return (
    <EmptyState
      icon={BarChart3}
      title="Nenhuma conta de anúncio ligada"
      description="As contas aparecem aqui depois de ligadas a um cliente e incluídas no sistema, em Configurações › Integrações (ou na aba Tráfego do cliente, pelo Facebook dele)."
      action={canConnect ? <Link href="/configuracoes/integracoes" className={buttonVariants({ variant: "outline" })}>Abrir Integrações</Link> : undefined}
    />
  );
}
