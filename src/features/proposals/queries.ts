import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Block, ProposalItem, ProposalSnapshot, ProposalStatus, Recurrence } from "@/domain/proposals";

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export type Template = {
  id: string;
  name: string;
  blocks: Block[];
  whatsappMessage: string;
  validityDays: number;
  version: number;
  isDefault: boolean;
  archivedAt: string | null;
  updatedAt: string;
  updatedBy: string | null;
};

const TPL = "id, name, blocks, whatsapp_message, validity_days, version, is_default, archived_at, updated_at, profiles!proposal_templates_updated_by_fkey(full_name)";
type TplRow = { id: string; name: string; blocks: unknown; whatsapp_message: string; validity_days: number; version: number; is_default: boolean; archived_at: string | null; updated_at: string; profiles: unknown };
const toTemplate = (t: TplRow): Template => ({
  id: t.id,
  name: t.name,
  blocks: t.blocks as Block[],
  whatsappMessage: t.whatsapp_message,
  validityDays: t.validity_days,
  version: t.version,
  isDefault: t.is_default,
  archivedAt: t.archived_at,
  updatedAt: t.updated_at,
  updatedBy: one(t.profiles as { full_name: string } | null)?.full_name ?? null,
});

export const listTemplates = cache(async (): Promise<Template[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("proposal_templates").select(TPL).order("is_default", { ascending: false }).order("name");
  if (error) throw error;
  return (data ?? []).map((t) => toTemplate(t as TplRow));
});

export async function getTemplate(id: string) {
  const supabase = await createClient();
  const [{ data, error }, { data: versions }] = await Promise.all([
    supabase.from("proposal_templates").select(TPL).eq("id", id).maybeSingle(),
    supabase.from("proposal_template_versions").select("version, name, created_at, profiles(full_name)").eq("template_id", id).order("version", { ascending: false }).limit(50),
  ]);
  if (error) throw error;
  if (!data) return null;
  return {
    ...toTemplate(data as TplRow),
    versions: (versions ?? []).map((v) => ({ version: v.version, name: v.name, createdAt: v.created_at, author: one(v.profiles as { full_name: string } | null)?.full_name ?? null })),
  };
}

export async function getTemplateVersion(id: string, version: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("proposal_template_versions").select("name, blocks, whatsapp_message, validity_days").eq("template_id", id).eq("version", version).maybeSingle();
  if (error) throw error;
  return data ? { name: data.name, blocks: data.blocks as Block[], whatsappMessage: data.whatsapp_message, validityDays: data.validity_days } : null;
}

export type Offer = { serviceId: string; name: string; isActive: boolean; description: string; priceCents: number | null; recurrence: Recurrence };

/** Catálogo comercial: todos os serviços do catálogo com descrição e preço padrão. */
export const listOffers = cache(async (): Promise<Offer[]> => {
  const supabase = await createClient();
  const [{ data: cat, error }, { data: offers }] = await Promise.all([
    supabase.from("service_catalog").select("id, name, is_active, position").order("position"),
    supabase.from("service_offers").select("service_id, description, price_cents, recurrence"),
  ]);
  if (error) throw error;
  const by = new Map((offers ?? []).map((o) => [o.service_id, o]));
  return (cat ?? []).map((s) => {
    const o = by.get(s.id);
    return { serviceId: s.id, name: s.name, isActive: s.is_active, description: o?.description ?? "", priceCents: o?.price_cents ?? null, recurrence: (o?.recurrence ?? "mensal") as Recurrence };
  });
});

export type ProposalRow = {
  id: string;
  number: number;
  leadId: string;
  leadName: string;
  clientName: string;
  status: ProposalStatus;
  monthlyCents: number;
  oneTimeCents: number;
  validUntil: string;
  viewCount: number;
  lastViewedAt: string | null;
  sentAt: string | null;
  ownerName: string | null;
  updatedAt: string;
};

const ROW = "id, number, lead_id, client_name, status, monthly_cents, one_time_cents, valid_until, view_count, last_viewed_at, sent_at, updated_at, leads(name), profiles!proposals_owner_id_fkey(full_name)";
type Row = { id: string; number: number; lead_id: string; client_name: string; status: string; monthly_cents: number; one_time_cents: number; valid_until: string; view_count: number; last_viewed_at: string | null; sent_at: string | null; updated_at: string; leads: unknown; profiles: unknown };
const toRow = (p: Row): ProposalRow => ({
  id: p.id,
  number: p.number,
  leadId: p.lead_id,
  leadName: one(p.leads as { name: string } | null)?.name ?? "",
  clientName: p.client_name,
  status: p.status as ProposalStatus,
  monthlyCents: p.monthly_cents,
  oneTimeCents: p.one_time_cents,
  validUntil: p.valid_until,
  viewCount: p.view_count,
  lastViewedAt: p.last_viewed_at,
  sentAt: p.sent_at,
  ownerName: one(p.profiles as { full_name: string } | null)?.full_name ?? null,
  updatedAt: p.updated_at,
});

export async function listProposals(leadId?: string): Promise<ProposalRow[]> {
  const supabase = await createClient();
  let q = supabase.from("proposals").select(ROW).order("updated_at", { ascending: false }).limit(500);
  if (leadId) q = q.eq("lead_id", leadId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((p) => toRow(p as Row));
}

export type ProposalDetail = ProposalRow & {
  templateId: string | null;
  contactName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  items: ProposalItem[];
  paymentTerms: string;
  notes: string;
  version: number;
  sentVersion: number | null;
  publicToken: string;
  firstViewedAt: string | null;
  acceptedAt: string | null;
  acceptedName: string | null;
  refusedAt: string | null;
  refusedReason: string | null;
  leadWonClientId: string | null;
  versions: { version: number; createdAt: string; author: string | null; monthlyCents: number; oneTimeCents: number }[];
  views: { at: string; version: number | null }[];
};

export async function getProposal(id: string): Promise<ProposalDetail | null> {
  const supabase = await createClient();
  const [{ data: p, error }, { data: versions }, { data: views }] = await Promise.all([
    supabase
      .from("proposals")
      .select(
        "id, number, lead_id, client_name, status, monthly_cents, one_time_cents, valid_until, view_count, last_viewed_at, sent_at, updated_at, profiles!proposals_owner_id_fkey(full_name), template_id, contact_name, contact_phone, contact_email, items, payment_terms, notes, version, sent_version, public_token, first_viewed_at, accepted_at, accepted_name, refused_at, refused_reason, leads(name, won_client_id)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("proposal_versions").select("version, created_at, monthly_cents, one_time_cents, profiles(full_name)").eq("proposal_id", id).order("version", { ascending: false }),
    supabase.from("proposal_views").select("viewed_at, version").eq("proposal_id", id).order("viewed_at", { ascending: false }).limit(100),
  ]);
  if (error) throw error;
  if (!p) return null;
  const lead = one(p.leads as { name: string; won_client_id: string | null } | null);
  return {
    ...toRow(p as unknown as Row),
    templateId: p.template_id,
    contactName: p.contact_name,
    contactPhone: p.contact_phone,
    contactEmail: p.contact_email,
    items: p.items as ProposalItem[],
    paymentTerms: p.payment_terms,
    notes: p.notes,
    version: p.version,
    sentVersion: p.sent_version,
    publicToken: p.public_token,
    firstViewedAt: p.first_viewed_at,
    acceptedAt: p.accepted_at,
    acceptedName: p.accepted_name,
    refusedAt: p.refused_at,
    refusedReason: p.refused_reason,
    leadWonClientId: lead?.won_client_id ?? null,
    versions: (versions ?? []).map((v) => ({ version: v.version, createdAt: v.created_at, author: one(v.profiles as { full_name: string } | null)?.full_name ?? null, monthlyCents: v.monthly_cents, oneTimeCents: v.one_time_cents })),
    views: (views ?? []).map((v) => ({ at: v.viewed_at, version: v.version })),
  };
}

export async function getSnapshot(id: string, version: number): Promise<ProposalSnapshot | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("proposal_versions").select("snapshot").eq("proposal_id", id).eq("version", version).maybeSingle();
  if (error) throw error;
  return (data?.snapshot as ProposalSnapshot | undefined) ?? null;
}

/** Propostas enviadas e aceitas no período (painel comercial, RF-CRM-08). */
export async function proposalCounts(from: Date, to: Date): Promise<{ sent: number; accepted: number; acceptedCents: number }> {
  const supabase = await createClient();
  const [{ count: sent }, { data: acc }] = await Promise.all([
    supabase.from("proposals").select("id", { count: "exact", head: true }).gte("sent_at", from.toISOString()).lt("sent_at", to.toISOString()),
    supabase.from("proposals").select("monthly_cents").gte("accepted_at", from.toISOString()).lt("accepted_at", to.toISOString()),
  ]);
  return { sent: sent ?? 0, accepted: acc?.length ?? 0, acceptedCents: (acc ?? []).reduce((s, x) => s + x.monthly_cents, 0) };
}
