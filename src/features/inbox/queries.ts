import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { InboxTab } from "@/domain/inbox";

// Leitura com o login da pessoa: a RLS mostra as conversas a quem tem "Ver conversas do WhatsApp".

export type ConversationRow = {
  id: string;
  contactName: string;
  phone: string | null;
  leadId: string | null;
  leadName: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  status: "aberta" | "encerrada";
  waitingReply: boolean;
  unread: number;
  preview: string | null;
  lastMessageAt: string | null;
};

type Raw = {
  id: string; contact_name: string; phone: string | null; lead_id: string | null; assignee_id: string | null; status: string; waiting_reply: boolean;
  unread_count: number; last_preview: string | null; last_message_at: string | null; assignee: { full_name: string } | null; lead: { name: string } | null;
};

const SELECT = "id, contact_name, phone, lead_id, assignee_id, status, waiting_reply, unread_count, last_preview, last_message_at, assignee:profiles!wa_conversations_assignee_id_fkey(full_name), lead:leads(name)";

const toRow = (r: Raw): ConversationRow => ({
  id: r.id, contactName: r.contact_name, phone: r.phone, leadId: r.lead_id, leadName: r.lead?.name ?? null, assigneeId: r.assignee_id,
  assigneeName: r.assignee?.full_name ?? null, status: r.status as ConversationRow["status"], waitingReply: r.waiting_reply,
  unread: r.unread_count, preview: r.last_preview, lastMessageAt: r.last_message_at,
});

/** Conversas de uma aba e a contagem das abas. */
export async function listConversations(tab: InboxTab, userId: string) {
  const supabase = await createClient();
  let q = supabase.from("wa_conversations").select(SELECT).order("last_message_at", { ascending: false, nullsFirst: false }).limit(300);
  if (tab === "encerradas") q = q.eq("status", "encerrada");
  else q = q.eq("status", "aberta");
  if (tab === "aguardando") q = q.eq("waiting_reply", true);
  if (tab === "minhas") q = q.eq("assignee_id", userId);
  const count = (f: (b: ReturnType<typeof base>) => ReturnType<typeof base>) => f(base());
  const base = () => supabase.from("wa_conversations").select("id", { count: "exact", head: true }).eq("status", "aberta");
  const [list, open, waiting, mine] = await Promise.all([q, count((b) => b), count((b) => b.eq("waiting_reply", true)), count((b) => b.eq("assignee_id", userId))]);
  if (list.error) throw list.error;
  return {
    rows: ((list.data ?? []) as unknown as Raw[]).map(toRow),
    counts: { abertas: open.count ?? 0, aguardando: waiting.count ?? 0, minhas: mine.count ?? 0 },
  };
}

export type ChatMessage = { id: string; fromMe: boolean; body: string | null; kind: string; sentAt: string; authorName: string | null };

/** Uma conversa com as últimas 200 mensagens e o lead ligado (se a pessoa vê o Comercial). */
export async function getConversation(id: string, canSeeLeads: boolean) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("wa_conversations").select(`${SELECT}, connection_id, chat_id`).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const raw = data as unknown as Raw & { connection_id: string; chat_id: string };
  const [{ data: msgs }, lead] = await Promise.all([
    supabase.from("whatsapp_messages").select("id, from_me, body, kind, sent_at, author_name").eq("connection_id", raw.connection_id).eq("chat_id", raw.chat_id)
      .order("sent_at", { ascending: false }).limit(200),
    raw.lead_id && canSeeLeads
      ? supabase.from("leads").select("id, name, company, value_cents, stage:pipeline_stages(name, color)").eq("id", raw.lead_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const l = lead.data as { id: string; name: string; company: string | null; value_cents: number | null; stage: { name: string; color: string } | null } | null;
  return {
    conversation: toRow(raw),
    messages: (msgs ?? []).reverse().map((m): ChatMessage => ({ id: m.id, fromMe: m.from_me, body: m.body, kind: m.kind, sentAt: m.sent_at, authorName: m.author_name })),
    lead: l ? { id: l.id, name: l.name, company: l.company, valueCents: l.value_cents === null ? null : Number(l.value_cents), stageName: l.stage?.name ?? null, stageColor: l.stage?.color ?? null } : null,
  };
}

export async function listAgents(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("inbox_agents");
  return (data ?? []).map((a) => ({ id: a.id, name: a.full_name }));
}

/** Situação do número da Extend (para avisar quando não dá para responder). */
export async function getWhatsappState(): Promise<{ connected: boolean; status: string | null } | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("whatsapp_status");
  const c = (data ?? [])[0];
  return c ? { connected: c.status === "WORKING", status: c.status } : null;
}
