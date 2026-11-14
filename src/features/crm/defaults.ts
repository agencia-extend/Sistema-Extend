import type { LeadFormValues } from "./components/lead-dialog";
import type { LeadDetail, Pipeline } from "./queries";

/** Funil pedido na URL ou o principal. */
export function pickPipeline(pipelines: Pipeline[], id: string | undefined): Pipeline | null {
  return pipelines.find((p) => p.id === id) ?? pipelines[0] ?? null;
}

export function blankLead(p: Pipeline): LeadFormValues {
  const first = p.stages.find((s) => s.kind === "aberta") ?? p.stages[0];
  return {
    pipelineId: p.id,
    stageId: first?.id ?? "",
    name: "",
    company: "",
    phone: "",
    email: "",
    source: "anuncio",
    utmSource: "",
    utmMedium: "",
    utmCampaign: "",
    utmContent: "",
    utmTerm: "",
    valueCents: null,
    ownerId: null,
    notes: "",
  };
}

export function leadToForm(l: LeadDetail): LeadFormValues {
  return {
    id: l.id,
    pipelineId: l.pipelineId,
    stageId: l.stageId,
    name: l.name,
    company: l.company ?? "",
    phone: l.phone ?? "",
    email: l.email ?? "",
    source: l.source,
    utmSource: l.utm.source ?? "",
    utmMedium: l.utm.medium ?? "",
    utmCampaign: l.utm.campaign ?? "",
    utmContent: l.utm.content ?? "",
    utmTerm: l.utm.term ?? "",
    valueCents: l.valueCents,
    ownerId: l.ownerId,
    notes: l.notes ?? "",
  };
}
