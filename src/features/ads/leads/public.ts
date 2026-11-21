import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LeadQuality } from "@/domain/ads/client-leads";

// Página pública /avaliar-leads/[código] (RF-T2-01): o cliente vê os leads das campanhas dele e avalia. Só o hash do
// código é consultado; nada de outro cliente sai daqui.

export const PUBLIC_DAYS = [30, 60, 90] as const;
export type PublicLead = { id: string; name: string | null; phone: string | null; email: string | null; leadAt: string; campaign: string | null; quality: LeadQuality | null; note: string | null };

export async function getPublicLeadReview(token: string, days: number) {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token) || !process.env.SUPABASE_SECRET_KEY) return null;
  const admin = createAdminClient();
  const { data: link } = await admin
    .from("lead_review_links")
    .select("id, client_id, revoked_at, clients(name, deleted_at)")
    .eq("token_hash", createHash("sha256").update(token).digest("hex"))
    .maybeSingle();
  if (!link) return null;
  const c = (Array.isArray(link.clients) ? link.clients[0] : link.clients) as { name: string; deleted_at: string | null } | null;
  if (!c || c.deleted_at) return null;
  if (link.revoked_at) return { state: "cancelado" as const, clientName: c.name, leads: [] as PublicLead[] };
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data } = await admin
    .from("client_leads")
    .select("id, name, phone, email, lead_at, campaign_name, quality, quality_note, campaign:ad_campaigns(name)")
    .eq("client_id", link.client_id)
    .gte("lead_at", since)
    .order("lead_at", { ascending: false })
    .limit(500);
  const leads: PublicLead[] = (data ?? []).map((l) => {
    const camp = Array.isArray(l.campaign) ? l.campaign[0] : l.campaign;
    return { id: l.id, name: l.name, phone: l.phone, email: l.email, leadAt: l.lead_at, campaign: camp?.name ?? l.campaign_name, quality: l.quality as LeadQuality | null, note: l.quality_note };
  });
  return { state: "aberto" as const, clientName: c.name, leads };
}
