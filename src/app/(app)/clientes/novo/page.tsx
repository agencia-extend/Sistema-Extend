import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/dal";
import { listCatalog } from "@/features/clients/queries";
import { getLead } from "@/features/crm/queries";
import { getProposal } from "@/features/proposals/queries";
import { lineTotal } from "@/domain/proposals";
import { formatPhone } from "@/domain/crm";
import { centsToInput } from "@/domain/shared/money";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { FormAlert } from "@/components/app/form-field";
import { HandoffForm, type HandoffLead } from "./handoff-form";

export const metadata: Metadata = { title: "Novo fechamento" };

/** Fechamento comercial. Vindo de um lead ganho (?lead=), já chega preenchido e liga o cliente ao lead. */
export default async function NovoFechamentoPage({ searchParams }: { searchParams: Promise<{ lead?: string; proposta?: string }> }) {
  const [user, sp] = await Promise.all([requirePermission("commercial.handoff.create"), searchParams]);
  const fromLead = sp.lead && /^[0-9a-f-]{36}$/i.test(sp.lead) && user.permissions["crm.leads.read"] ? await getLead(sp.lead) : null;
  const proposal =
    fromLead && sp.proposta && /^[0-9a-f-]{36}$/i.test(sp.proposta) && user.permissions["proposals.read"] ? await getProposal(sp.proposta) : null;
  const accepted = proposal && proposal.leadId === fromLead?.id && proposal.status === "aceita" ? proposal : null;
  const catalog = await listCatalog();
  const picked: Record<string, string> = {};
  for (const i of accepted?.items ?? []) if (i.serviceId && i.recurrence === "mensal") picked[i.serviceId] = centsToInput(lineTotal(i));
  const lead: HandoffLead | undefined =
    fromLead && !fromLead.wonClientId
      ? {
          id: fromLead.id,
          name: fromLead.company || fromLead.name,
          contact: { name: fromLead.name, phone: formatPhone(fromLead.phone), email: fromLead.email ?? "" },
          monthlyFee: centsToInput(accepted ? accepted.monthlyCents : fromLead.valueCents),
          notes: fromLead.notes ?? "",
          ...(accepted
            ? {
                name: accepted.clientName,
                contact: { name: accepted.contactName || fromLead.name, phone: formatPhone(accepted.contactPhone ?? fromLead.phone), email: accepted.contactEmail ?? fromLead.email ?? "" },
                picked,
                setupFee: accepted.oneTimeCents ? centsToInput(accepted.oneTimeCents) : "",
                paymentMethod: accepted.paymentTerms.slice(0, 80),
              }
            : {}),
        }
      : undefined;
  return (
    <>
      <PageHeader
        breadcrumbs={lead ? [{ label: "Comercial", href: "/comercial" }, { label: fromLead!.name, href: `/comercial/leads/${fromLead!.id}` }, { label: "Fechamento" }] : [{ label: "Clientes", href: "/clientes" }, { label: "Novo fechamento" }]}
        title="Novo fechamento comercial"
        description="Registre o que foi vendido. O cliente nasce em onboarding e a equipe é avisada na hora, sem depender do grupo de WhatsApp."
      />
      <PageBody className="grid max-w-3xl gap-4">
        {lead && <FormAlert tone="info">{accepted ? `Preenchido com a proposta nº ${String(accepted.number).padStart(4, "0")} aceita: serviços, valores e forma de pagamento.` : "Preenchido com os dados do lead."} Ao registrar, o lead vai para Ganho e fica ligado ao cliente.</FormAlert>}
        {fromLead?.wonClientId && <FormAlert tone="info">Este lead já virou cliente. O fechamento abaixo cria um cliente novo, sem ligação com o lead.</FormAlert>}
        <HandoffForm services={catalog.filter((s) => s.is_active).map((s) => ({ id: s.id, name: s.name, unit: s.unit }))} lead={lead} />
      </PageBody>
    </>
  );
}
