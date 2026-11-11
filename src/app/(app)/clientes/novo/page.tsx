import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/dal";
import { listCatalog } from "@/features/clients/queries";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { HandoffForm } from "./handoff-form";

export const metadata: Metadata = { title: "Novo fechamento" };

export default async function NovoFechamentoPage() {
  await requirePermission("commercial.handoff.create");
  const catalog = await listCatalog();
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Clientes", href: "/clientes" }, { label: "Novo fechamento" }]}
        title="Novo fechamento comercial"
        description="Registre o que foi vendido. O cliente nasce em onboarding e a equipe é avisada na hora, sem depender do grupo de WhatsApp."
      />
      <PageBody className="max-w-3xl">
        <HandoffForm services={catalog.filter((s) => s.is_active).map((s) => ({ id: s.id, name: s.name, unit: s.unit }))} />
      </PageBody>
    </>
  );
}
