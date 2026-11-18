import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { chatKind, historyMessage, looksLikePhone, phoneOfJid, type HistoryMessage } from "@/domain/whatsapp/history";
import { wahaConn } from "./store";
import { WahaError, wahaChatMessages, wahaChatsOverview, wahaGroupName, wahaLidPhone, type WahaConn } from "./waha";

// "Compilar conversas" (adaptado do HubSystem, src/lib/whatsapp-import.ts): traz o histórico do aparelho para o
// Atendimento em etapas curtas. A tela chama de novo até terminar; sem a tela, o relógio do banco continua.

const CHATS_PER_PAGE = 20;
const MESSAGES_PER_PAGE = 100;
/** Até 500 mensagens recentes por conversa. */
export const MAX_MESSAGES_PER_CHAT = 500;
/** O aparelho envia o histórico aos poucos depois do QR Code: passa de novo para pegar o que chegou depois. */
const PASS_WAIT_SECONDS: Record<number, number> = { 1: 120, 2: 300 };
const LAST_PASS = 3;
const MAX_FAILURES_IN_A_ROW = 3;
const LEASE_SECONDS = 90;
const GIVE_UP_MS = 2 * 3600_000;
export const STORE_OFF = "Este número foi conectado sem guardar o histórico. Use \"Conectar de novo e trazer tudo\" e leia o QR Code outra vez.";

type Job = { id: string; organization_id: string; connection_id: string; include_contacts: boolean; include_groups: boolean; pass: number; next_offset: number; skipped: number; messages_done: number; created_at: string };

const isStoreOff = (e: unknown) => e instanceof WahaError && e.status === 400 && /store/i.test(e.detail ?? "");

async function fetchMessages(conn: WahaConn, chatId: string, group: boolean) {
  const items: HistoryMessage[] = [];
  let alt: string | null = null;
  let pushName: string | null = null;
  for (let offset = 0; offset < MAX_MESSAGES_PER_CHAT; offset += MESSAGES_PER_PAGE) {
    const page = await wahaChatMessages(conn, chatId, MESSAGES_PER_PAGE, offset);
    for (const raw of Array.isArray(page) ? page : []) {
      const m = historyMessage(raw, group);
      if (!m) continue;
      alt ??= m.alt;
      if (!m.from_me) pushName ??= m.pushName;
      const { alt: _a, pushName: _p, ...row } = m;
      void _a;
      void _p;
      items.push(row);
    }
    if (!Array.isArray(page) || page.length < MESSAGES_PER_PAGE) break;
  }
  return { items: items.slice(0, MAX_MESSAGES_PER_CHAT), alt, pushName };
}

/** Uma conversa. Devolve as mensagens novas, ou null se não der para identificar o contato. */
async function importChat(conn: WahaConn, connectionId: string, ownPhone: string | null, chat: { id: string; name?: string | null }) {
  const group = chatKind(chat.id) === "grupo";
  const { items, alt, pushName } = await fetchMessages(conn, chat.id, group);
  let phone: string | null = null;
  let name = chat.name?.trim() ?? "";
  if (group) {
    if (!name) name = (await wahaGroupName(conn, chat.id).catch(() => null))?.trim() ?? "";
  } else {
    phone = phoneOfJid(chat.id) ?? phoneOfJid(alt) ?? (chat.id.endsWith("@lid") ? phoneOfJid(await wahaLidPhone(conn, chat.id).catch(() => null)) : null);
    if (!phone && chat.id.endsWith("@lid") && !items.length) return null;
    if (phone && ownPhone && phone === ownPhone) return 0; // conversa consigo mesmo
    if (!name || looksLikePhone(name)) name = pushName ?? "";
  }
  const { data, error } = await createAdminClient().rpc("wa_import_chat", {
    p_connection: connectionId, p_chat: chat.id, p_kind: group ? "grupo" : "contato", p_phone: phone as string, p_name: name, p_messages: items,
  });
  if (error) throw new Error("import_rpc");
  return (data as number) ?? 0;
}

async function claim(jobId: string) {
  const now = new Date().toISOString();
  const { data } = await createAdminClient()
    .from("wa_imports")
    .update({ lease_until: new Date(Date.now() + LEASE_SECONDS * 1000).toISOString(), status: "importando", updated_at: now })
    .eq("id", jobId)
    .in("status", ["importando", "aguardando"])
    .lte("not_before", now)
    .or(`lease_until.is.null,lease_until.lt.${now}`)
    .select("id, organization_id, connection_id, include_contacts, include_groups, pass, next_offset, skipped, messages_done, created_at")
    .maybeSingle();
  return data as Job | null;
}

async function counts(connectionId: string) {
  const db = createAdminClient();
  const of = (kind: string) => db.from("wa_conversations").select("id", { count: "exact", head: true }).eq("connection_id", connectionId).eq("kind", kind).not("imported_at", "is", null);
  const [contacts, groups] = await Promise.all([of("contato"), of("grupo")]);
  return { contacts_done: contacts.count ?? 0, groups_done: groups.count ?? 0 };
}

/** Uma etapa da compilação, dentro do tempo dado. A próxima continua de onde esta parou. */
export async function runImportStep(jobId: string, budgetMs: number) {
  const db = createAdminClient();
  const job = await claim(jobId);
  if (!job) return;
  const deadline = Date.now() + budgetMs;
  const state = { offset: job.next_offset, skipped: job.skipped, messages: job.messages_done };
  const save = async (patch: Record<string, unknown>) => {
    await db
      .from("wa_imports")
      .update({ next_offset: state.offset, skipped: state.skipped, messages_done: state.messages, lease_until: null, updated_at: new Date().toISOString(), ...(await counts(job.connection_id)), ...patch })
      .eq("id", job.id);
  };
  const retryLater = (message: string) =>
    Date.now() - new Date(job.created_at).getTime() > GIVE_UP_MS
      ? save({ status: "erro", last_error: message, finished_at: new Date().toISOString() })
      : save({ last_error: message, not_before: new Date(Date.now() + 60_000).toISOString() });

  const { data: c } = await db.from("whatsapp_connections").select("id, organization_id, base_url, api_key_enc, session, webhook_secret_enc, status, me_id").eq("id", job.connection_id).maybeSingle();
  if (!c) return save({ status: "erro", last_error: "O WhatsApp foi removido do sistema.", finished_at: new Date().toISOString() });
  if (c.status !== "WORKING") return retryLater("O WhatsApp está desconectado. A compilação continua quando ele voltar.");
  const conn = wahaConn(c);
  const ownPhone = phoneOfJid(c.me_id);

  let failures = 0;
  try {
    while (Date.now() < deadline) {
      const page = await wahaChatsOverview(conn, CHATS_PER_PAGE, state.offset);
      if (!page.length) {
        if (job.pass >= LAST_PASS) {
          await save({ status: "concluida", last_error: null, finished_at: new Date().toISOString() });
          const { data: who } = await db.from("wa_imports").select("created_by").eq("id", job.id).single();
          if (who?.created_by) {
            await db.rpc("notify_users", {
              p_users: [who.created_by], p_kind: "inbox", p_title: "Conversas compiladas",
              p_body: `${state.messages.toLocaleString("pt-BR")} mensagens do histórico já estão no Atendimento.`, p_href: "/atendimento", p_dedupe_key: `wa-import:${job.id}`, p_actor: null as unknown as string,
            });
          }
          return;
        }
        state.offset = 0;
        return await save({ status: "aguardando", pass: job.pass + 1, last_error: null, not_before: new Date(Date.now() + PASS_WAIT_SECONDS[job.pass] * 1000).toISOString() });
      }
      for (const chat of page) {
        if (Date.now() >= deadline) return await save({ last_error: null });
        const kind = chatKind(chat.id);
        if (kind === "ignorar" || (kind === "grupo" && !job.include_groups) || (kind === "contato" && !job.include_contacts)) {
          state.offset++;
          continue;
        }
        let inserted: number | null;
        try {
          inserted = await importChat(conn, job.connection_id, ownPhone, chat);
          failures = 0;
        } catch (e) {
          if (isStoreOff(e) || ++failures >= MAX_FAILURES_IN_A_ROW) throw e;
          // Uma conversa com problema não trava a compilação inteira.
          console.error("[whatsapp-import] conversa pulada");
          inserted = null;
        }
        if (inserted === null) {
          if (job.pass === 1) state.skipped++;
        } else {
          state.messages += inserted;
        }
        state.offset++;
      }
      await save({ last_error: null, lease_until: new Date(Date.now() + LEASE_SECONDS * 1000).toISOString() });
    }
    await save({ last_error: null });
  } catch (e) {
    if (isStoreOff(e)) return save({ status: "erro", last_error: STORE_OFF, finished_at: new Date().toISOString() });
    console.error("[whatsapp-import] falha em uma etapa");
    await retryLater("Não foi possível falar com o servidor do WhatsApp. Tentando de novo em instantes.");
  }
}

/** Relógio do banco: continua as compilações mesmo com a tela fechada. */
export async function runWhatsappImports(budgetMs = 45_000) {
  const deadline = Date.now() + budgetMs;
  const { data } = await createAdminClient().from("wa_imports").select("id").in("status", ["importando", "aguardando"]).lte("not_before", new Date().toISOString()).order("updated_at").limit(3);
  let ran = 0;
  for (const job of data ?? []) {
    const left = deadline - Date.now();
    if (left < 8000) break;
    await runImportStep(job.id, Math.min(left - 5000, 40_000));
    ran++;
  }
  return { ran };
}
