import type { Metadata } from "next";
import { Layers } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/states";
import { serviceGrid } from "@/features/clients/service-grid/queries";
import { ServiceGrid } from "@/features/clients/service-grid/grid";

export const metadata: Metadata = { title: "Serviços em lote" };

/** Quantidade mensal contratada de todos os clientes ativos numa tela só (ex.: clientes vindos do Trello). */
export default async function ServicosEmLotePage() {
  await requirePermission("clients.manage");
  const { services, rows } = await serviceGrid();
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Clientes", href: "/clientes" }, { label: "Serviços em lote" }]}
        title="Serviços em lote"
        description="Quanto cada cliente ativo tem contratado por mês. É o número que aparece em Demanda do mês e Cronogramas do mês e que gera as demandas mensais."
      />
      <PageBody>
        {rows.length && services.length ? (
          <ServiceGrid services={services} rows={rows} />
        ) : (
          <EmptyState icon={Layers} title={services.length ? "Nenhum cliente ativo" : "Nenhum serviço com quantidade mensal"}
            description={services.length ? "Quando houver clientes ativos, as quantidades deles aparecem aqui." : "Cadastre em Configurações › Serviços um serviço com unidade (posts, artes, vídeos)."} />
        )}
      </PageBody>
    </>
  );
}
