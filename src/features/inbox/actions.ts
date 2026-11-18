"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction, must } from "@/lib/actions";
import { fail, ok } from "@/domain/shared/result";
import { leadNameSchema, prepareMediaSchema, replySchema, sendMediaSchema } from "./schemas";
import { baseMime, checkOutgoingMedia, isOutgoingPath, outgoingPath } from "@/domain/whatsapp/media";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWhatsapp, wahaConn } from "@/lib/whatsapp/store";
import { WahaError, sentMessageId, wahaSendMedia, wahaSendText, wahaSession } from "@/lib/whatsapp/waha";

const id = z.uuid("Conversa inválida.");


const refresh = (conversationId?: string) => {
  revalidatePath("/atendimento");
  if (conversationId) revalidatePath(`/atendimento/${conversationId}`);
};

/** Responde pelo número da Extend. A mensagem entra na conversa na hora (o webhook não duplica: mesmo id). */
export const replyConversation = defineAction({ schema: replySchema, permission: "inbox.reply" }, async ({ id, text }, { user }) => {
  const supabase = await createClient();
  const { data: conv } = await supabase.from("wa_conversations").select("id, connection_id, chat_id").eq("id", id).maybeSingle();
  if (!conv) return fail("not_found", "Conversa não encontrada.");
  const c = await getWhatsapp(user.organizationId);
  if (!c || c.id !== conv.connection_id) return fail("business_rule", "O número desta conversa não está mais conectado ao sistema.");
  let wamid: string;
  try {
    const conn = wahaConn(c);
    const live = await wahaSession(conn);
    if (live?.status !== "WORKING") {
      await createAdminClient().from("whatsapp_connections").update({ status: live?.status ?? "STOPPED" }).eq("id", c.id);
      return fail("business_rule", "O WhatsApp da Extend não está conectado no servidor. Conecte pelo QR Code no Atendimento.");
    }
    const sent = await wahaSendText(conn, conv.chat_id, text);
    wamid = sentMessageId(sent) || `sistema-${randomUUID()}`;
  } catch (e) {
    return fail("network", e instanceof WahaError ? e.message : "Falha ao enviar pelo WhatsApp. Tente de novo.");
  }
  await createAdminClient().from("whatsapp_messages").upsert(
    { connection_id: conv.connection_id, wamid: wamid.slice(0, 200), chat_id: conv.chat_id, from_me: true, author_name: user.fullName ?? null, body: text, kind: "text", sent_at: new Date().toISOString() },
    { onConflict: "connection_id,wamid", ignoreDuplicates: true },
  );
  refresh(id);
  return ok(null);
});

/** Reserva o envio do arquivo direto do navegador para o armazenamento (arquivos grandes não passam pelo servidor). */
export const prepareMediaUpload = defineAction({ schema: prepareMediaSchema, permission: "inbox.reply" }, async ({ id, mime, size }, { user }) => {
  const supabase = await createClient();
  const { data: conv } = await supabase.from("wa_conversations").select("id").eq("id", id).maybeSingle();
  if (!conv) return fail("not_found", "Conversa não encontrada.");
  const check = checkOutgoingMedia({ mime, size });
  if (!check.ok) return fail("validation", check.message);
  const path = outgoingPath(user.organizationId, randomUUID());
  const { data, error } = await createAdminClient().storage.from("whatsapp-midia").createSignedUploadUrl(path);
  if (error || !data) return fail("network", "Não foi possível preparar o envio do arquivo. Tente de novo.");
  return ok({ path, token: data.token });
});

/** Envia o arquivo já guardado: o WhatsApp baixa por um link temporário, sem o armazenamento ficar público. */
export const sendMediaMessage = defineAction({ schema: sendMediaSchema, permission: "inbox.reply" }, async ({ id, path, mime, size, name, caption }, { user }) => {
  if (!isOutgoingPath(path, user.organizationId)) return fail("forbidden", "Arquivo inválido. Anexe de novo.");
  const check = checkOutgoingMedia({ mime, size });
  if (!check.ok) return fail("validation", check.message);
  const supabase = await createClient();
  const { data: conv } = await supabase.from("wa_conversations").select("id, connection_id, chat_id").eq("id", id).maybeSingle();
  if (!conv) return fail("not_found", "Conversa não encontrada.");
  const c = await getWhatsapp(user.organizationId);
  if (!c || c.id !== conv.connection_id) return fail("business_rule", "O número desta conversa não está mais conectado ao sistema.");
  const db = createAdminClient();
  const { data: signed } = await db.storage.from("whatsapp-midia").createSignedUrl(path, 3600);
  if (!signed) return fail("not_found", "O arquivo não chegou ao sistema. Anexe de novo.");
  const type = baseMime(mime);
  let wamid: string;
  try {
    const conn = wahaConn(c);
    const live = await wahaSession(conn);
    if (live?.status !== "WORKING") {
      await db.from("whatsapp_connections").update({ status: live?.status ?? "STOPPED" }).eq("id", c.id);
      return fail("business_rule", "O WhatsApp da Extend não está conectado no servidor. Conecte pelo QR Code no Atendimento.");
    }
    const sent = await wahaSendMedia(conn, conv.chat_id, { url: signed.signedUrl, mime: type, name, caption: caption || null, kind: check.kind });
    wamid = sentMessageId(sent) || `sistema-${randomUUID()}`;
  } catch (e) {
    return fail("network", e instanceof WahaError ? e.message : "O WhatsApp não aceitou o arquivo. Tente de novo.");
  }
  await db.from("whatsapp_messages").upsert(
    { connection_id: conv.connection_id, wamid: wamid.slice(0, 200), chat_id: conv.chat_id, from_me: true, author_name: user.fullName ?? null, body: caption || null, kind: "media",
      media_path: path, media_mime: type, media_name: name, sent_at: new Date().toISOString() },
    { onConflict: "connection_id,wamid" },
  );
  refresh(id);
  return ok(null);
});

export const assignConversation = defineAction({ schema: z.object({ id, userId: z.uuid().nullable() }), permission: "inbox.reply" }, async ({ id, userId }) => {
  const supabase = await createClient();
  must(await supabase.rpc("assign_conversation", { p_id: id, p_user: userId as string }));
  refresh(id);
  return ok(null, userId ? "Responsável definido." : "Conversa sem responsável.");
});

export const setConversationStatus = defineAction({ schema: z.object({ id, status: z.enum(["aberta", "encerrada"]) }), permission: "inbox.reply" }, async ({ id, status }) => {
  const supabase = await createClient();
  must(await supabase.rpc("set_conversation_status", { p_id: id, p_status: status }));
  refresh(id);
  return ok(null, status === "encerrada" ? "Conversa encerrada." : "Conversa reaberta.");
});

export const markConversationRead = defineAction({ schema: z.object({ id }), permission: "inbox.read" }, async ({ id }) => {
  const supabase = await createClient();
  must(await supabase.rpc("mark_conversation_read", { p_id: id }));
  revalidatePath("/atendimento");
  return ok(null);
});

export const createLeadFromConversation = defineAction(
  { schema: z.object({ id, name: leadNameSchema }), permission: "inbox.reply" },
  async ({ id, name }) => {
    const supabase = await createClient();
    must(await supabase.rpc("create_lead_from_conversation", { p_id: id, p_name: name }));
    refresh(id);
    revalidatePath("/comercial");
    return ok(null, "Lead criado no Comercial, no início do funil.");
  },
);

export const unlinkConversationLead = defineAction({ schema: z.object({ id }), permission: "inbox.reply" }, async ({ id }) => {
  const supabase = await createClient();
  must(await supabase.rpc("link_conversation_lead", { p_id: id, p_lead: null as unknown as string }));
  refresh(id);
  return ok(null, "Lead desligado da conversa.");
});
