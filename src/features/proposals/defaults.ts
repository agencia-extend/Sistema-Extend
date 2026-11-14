import "server-only";
import { formatPhone } from "@/domain/crm";
import { addDaysSP } from "@/domain/proposals";
import { centsToInput } from "@/domain/shared/money";
import type { ItemDraft } from "./components/items-editor";
import type { ProposalDraft } from "./components/proposal-editor";
import type { ProposalDetail, Template } from "./queries";

type LeadLike = { id: string; name: string; company: string | null; phone: string | null; email: string | null };

export function draftFromLead(lead: LeadLike, template: Template): ProposalDraft {
  return {
    leadId: lead.id,
    number: null,
    templateId: template.id,
    clientName: lead.company || lead.name,
    contactName: lead.name,
    contactPhone: lead.phone ? formatPhone(lead.phone) : "",
    contactEmail: lead.email ?? "",
    items: [],
    paymentTerms: "",
    notes: "",
    validUntil: addDaysSP(template.validityDays),
  };
}

export function draftFromProposal(p: ProposalDetail, fallbackTemplate: string): ProposalDraft {
  return {
    id: p.id,
    leadId: p.leadId,
    number: p.number,
    templateId: p.templateId ?? fallbackTemplate,
    clientName: p.clientName,
    contactName: p.contactName,
    contactPhone: p.contactPhone ? formatPhone(p.contactPhone) : "",
    contactEmail: p.contactEmail ?? "",
    items: p.items.map<ItemDraft>((i, n) => ({
      key: `i${n}`,
      serviceId: i.serviceId,
      name: i.name,
      description: i.description,
      price: centsToInput(i.priceCents),
      discount: i.discountCents ? centsToInput(i.discountCents) : "",
      quantity: String(i.quantity),
      recurrence: i.recurrence,
    })),
    paymentTerms: p.paymentTerms,
    notes: p.notes,
    validUntil: p.validUntil,
  };
}
