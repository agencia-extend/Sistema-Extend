import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { InboxFilters, TagColor } from "@/domain/inbox";

// Leitura com o login da pessoa: a RLS mostra as conversas a quem tem "Ver conversas do WhatsApp".

export type Tag = { id: string; name: string; color: TagColor };

export type ConversationRow = {
  id: string;
  kind: "contato" | "grupo";
  contactName: string;
  phone: string | null;
  avatarUrl: string | null;
  leadId: string | null;
  leadName: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  status: "aberta" | "encerrada";
  deleted: boolean;
  waitingReply: boolean;
  unread: number;
  preview: string | null;
  lastMessageAt: string | null;
  lastInboundAt: string | null;
  tagIds: string[];
  fromAd: boolean;
};

type Raw = {
  id: string; kind: string; contact_name: string; phone: string | null; avatar_url: string | null; lead_id: string | null; assignee_id: string | null; status: string;
  deleted_at: string | null; waiting_reply: boolean; unread_count: number; last_preview: string | null; last_message_at: string | null; last_inbound_at: string | null; ad_at: string | null;
  assignee: { full_name: string } | null; lead: { name: string } | null; tags: { tag_id: string }[] | null;
};

const SELECT =
  "id, kind, contact_name, phone, avatar_url, lead_id, assignee_id, status, deleted_at, waiting_reply, unread_count, last_preview, last_message_at, last_inbound_at, ad_at, assignee:profiles!wa_conversations_assignee_id_fkey(full_name), lead:leads(name), tags:wa_conversation_tags(tag_id)";

const toRow = (r: Raw): ConversationRow => ({
  id: r.id, kind: r.kind === "grupo" ? "grupo" : "contato", contactName: r.contact_name, phone: r.phone, avatarUrl: r.avatar_url, leadId: r.lead_id, leadName: r.lead?.name ?? null,
  assigneeId: r.assignee_id, assigneeName: r.assignee?.full_name ?? null, status: r.status as ConversationRow["status"], deleted: Boolean(r.deleted_at), waitingReply: r.waiting_reply,
  unread: r.unread_count, preview: r.last_preview, lastMessageAt: r.last_message_at, lastInboundAt: r.last_inbound_at, tagIds: (r.tags ?? []).map((t) => t.tag_id), fromAd: Boolean(r.ad_at),
});

/** Minutos até a conversa sem resposta entrar no radar (RF-WPP-07). */
export async function getInboxSettings(): Promise<{ radarMinutes: number }> {
  const supabase = await createClient();
  const { data } = await supabase.from("wa_settings").select("radar_minutes").maybeSingle();
  return { radarMinutes: data?.radar_minutes ?? 15 };
}

const PAGE = 200;

/** Conversas da aba com busca e filtros, e a contagem das abas. */
export async function listConversations(f: InboxFilters, userId: string, radarMinutes: number, canManage: boolean) {
  const supabase = await createClient();
  const radarSince = new Date(Date.now() - radarMinutes * 60_000).toISOString();
  let q = supabase.from("wa_conversations").select(SELECT);
  if (f.tab === "apagadas") q = q.not("deleted_at", "is", null);
  else {
    q = q.is("deleted_at", null).eq("status", f.tab === "encerradas" ? "encerrada" : "aberta");
    if (f.tab === "grupos") q = q.eq("kind", "grupo");
    else if (f.tab !== "encerradas") q = q.eq("kind", "contato");
    if (f.tab === "aguardando" || f.tab === "radar") q = q.eq("waiting_reply", true);
    if (f.tab === "radar") q = q.lt("last_inbound_at", radarSince);
    if (f.tab === "minhas") q = q.eq("assignee_id", userId);
  }
  if (f.q) {
    const digits = f.q.replace(/\D/g, "");
    q = q.or([`contact_name.ilike.%${f.q}%`, `last_preview.ilike.%${f.q}%`, ...(digits.length >= 4 ? [`phone.like.%${digits}%`] : [])].join(","));
  }
  if (f.assignee === "ninguem") q = q.is("assignee_id", null);
  else if (f.assignee) q = q.eq("assignee_id", f.assignee);
  if (f.tag) {
    const { data: tagged } = await supabase.from("wa_conversation_tags").select("conversation_id").eq("tag_id", f.tag).limit(2000);
    q = q.in("id", (tagged ?? []).map((t) => t.conversation_id).concat("00000000-0000-0000-0000-000000000000"));
  }
  q = f.tab === "radar" ? q.order("last_inbound_at", { ascending: true }) : q.order("last_message_at", { ascending: false, nullsFirst: false });

  const base = () => supabase.from("wa_conversations").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", "aberta");
  const [list, open, waiting, radar, mine, groups, deleted] = await Promise.all([
    q.limit(PAGE),
    base().eq("kind", "contato"),
    base().eq("kind", "contato").eq("waiting_reply", true),
    base().eq("kind", "contato").eq("waiting_reply", true).lt("last_inbound_at", radarSince),
    base().eq("kind", "contato").eq("assignee_id", userId),
    base().eq("kind", "grupo"),
    canManage ? supabase.from("wa_conversations").select("id", { count: "exact", head: true }).not("deleted_at", "is", null) : Promise.resolve({ count: 0 }),
  ]);
  if (list.error) throw list.error;
  const rows = ((list.data ?? []) as unknown as Raw[]).map(toRow);
  return {
    rows,
    truncated: rows.length === PAGE,
    counts: { abertas: open.count ?? 0, aguardando: waiting.count ?? 0, radar: radar.count ?? 0, minhas: mine.count ?? 0, grupos: groups.count ?? 0, apagadas: deleted.count ?? 0 },
  };
}

export type ChatMessage = {
  id: string; fromMe: boolean; body: string | null; kind: string; sentAt: string; authorName: string | null; ack: "enviada" | "entregue" | "lida" | "erro" | null;
  /** Arquivo guardado no sistema (aberto por /api/whatsapp/midia/[id]); sem ele, a mídia é antiga ou não chegou. */
  hasFile: boolean; mediaMime: string | null; mediaName: string | null;
};

export type AdOrigin = { sourceId: string | null; headline: string | null; url: string | null; at: string; adName: string | null; campaignName: string | null };

/** Uma conversa com as últimas 300 mensagens, o lead ligado (se a pessoa vê o Comercial) e o anúncio de origem. */
export async function getConversation(id: string, canSeeLeads: boolean) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("wa_conversations").select(`${SELECT}, connection_id, chat_id, ad_source_id, ad_headline, ad_source_url`).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const raw = data as unknown as Raw & { connection_id: string; chat_id: string; ad_source_id: string | null; ad_headline: string | null; ad_source_url: string | null };
  const [{ data: msgs }, lead, group, ad] = await Promise.all([
    supabase.from("whatsapp_messages").select("id, from_me, body, kind, sent_at, author_name, ack, media_path, media_mime, media_name").eq("connection_id", raw.connection_id).eq("chat_id", raw.chat_id)
      .order("sent_at", { ascending: false }).limit(300),
    raw.lead_id && canSeeLeads
      ? supabase.from("leads").select("id, name, company, value_cents, stage:pipeline_stages(name, color)").eq("id", raw.lead_id).maybeSingle()
      : Promise.resolve({ data: null }),
    raw.kind === "grupo"
      ? supabase.from("whatsapp_groups").select("client_id, client:clients(name)").eq("connection_id", raw.connection_id).eq("jid", raw.chat_id).maybeSingle()
      : Promise.resolve({ data: null }),
    raw.ad_source_id ? supabase.from("ads").select("name, campaign:ad_campaigns(name)").eq("external_id", raw.ad_source_id).limit(1).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const g = group.data as { client_id: string | null; client: { name: string } | null } | null;
  const l = lead.data as { id: string; name: string; company: string | null; value_cents: number | null; stage: { name: string; color: string } | null } | null;
  const a = ad.data as { name: string; campaign: { name: string } | null } | null;
  return {
    conversation: toRow(raw),
    messages: (msgs ?? []).reverse().map((m): ChatMessage => ({
      id: m.id, fromMe: m.from_me, body: m.body, kind: m.kind, sentAt: m.sent_at, authorName: m.author_name, ack: (m.ack as ChatMessage["ack"]) ?? null,
      hasFile: Boolean(m.media_path), mediaMime: m.media_mime, mediaName: m.media_name,
    })),
    group: raw.kind === "grupo" ? { clientId: g?.client_id ?? null, clientName: g?.client?.name ?? null } : null,
    lead: l ? { id: l.id, name: l.name, company: l.company, valueCents: l.value_cents === null ? null : Number(l.value_cents), stageName: l.stage?.name ?? null, stageColor: l.stage?.color ?? null } : null,
    ad: raw.ad_at ? ({ sourceId: raw.ad_source_id, headline: raw.ad_headline, url: raw.ad_source_url, at: raw.ad_at, adName: a?.name ?? null, campaignName: a?.campaign?.name ?? null } satisfies AdOrigin) : null,
  };
}

export async function listAgents(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("inbox_agents");
  return (data ?? []).map((a) => ({ id: a.id, name: a.full_name }));
}

export async function listTags(): Promise<Tag[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("wa_tags").select("id, name, color").order("name");
  return (data ?? []).map((t) => ({ id: t.id, name: t.name, color: t.color as TagColor }));
}

export type QuickReply = { id: string; shortcut: string; body: string };
export async function listQuickReplies(): Promise<QuickReply[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("wa_quick_replies").select("id, shortcut, body").order("shortcut");
  return data ?? [];
}

/** Situação do número da Extend (para avisar quando não dá para responder). */
export async function getWhatsappState(): Promise<{ connected: boolean; status: string | null } | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("whatsapp_status");
  const c = (data ?? [])[0];
  return c ? { connected: c.status === "WORKING", status: c.status } : null;
}
