import { Suspense, type ReactNode } from "react";
import { requirePermission } from "@/lib/auth/dal";
import { PageHeader } from "@/components/app/page-header";
import { AdsTabs } from "@/features/ads/components/module/ads-tabs";
import { SyncButton } from "@/features/ads/components/sync-button";

export const maxDuration = 60;

/** Módulo Anúncios (como no HubSystem): visão geral, clientes, campanhas, anúncios e alertas, com os mesmos filtros. */
export default async function AnunciosLayout({ children }: { children: ReactNode }) {
  const user = await requirePermission(["ads.read"]);
  return (
    <>
      <PageHeader
        title="Anúncios"
        description="Meta Ads de todos os clientes: resultados do período comparados ao anterior, campanhas e anúncios, com ajuste de orçamento e pausa pelo sistema. Números atualizados a cada 3 horas."
        actions={user.permissions["ads.connect"] ? <SyncButton clientId={null} /> : undefined}
      />
      <div className="px-4 sm:px-6">
        <Suspense>
          <AdsTabs />
        </Suspense>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 px-4 pt-5 pb-8 sm:px-6">{children}</div>
    </>
  );
}
