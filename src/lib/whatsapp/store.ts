import "server-only";
import { decrypt } from "@/lib/crypto";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { WahaError, wahaSendText, wahaSession, type WahaConn } from "./waha";

// Só o servidor lê whatsapp_connections (chave e segredo cifrados).

export type StoredWhatsapp = { id: string; organization_id: string; base_url: string; api_key_enc: string; session: string; webhook_secret_enc: string; status: string };

export async function getWhatsapp(organizationId: string): Promise<StoredWhatsapp | null> {
  const { data } = await createAdminClient().from("whatsapp_connections").select("id, organization_id, base_url, api_key_enc, session, webhook_secret_enc, status").eq("organization_id", organizationId).maybeSingle();
  return (data as StoredWhatsapp | null) ?? null;
}

export const wahaConn = (c: StoredWhatsapp): WahaConn => ({ url: c.base_url.replace(/\/+$/, ""), key: decrypt(c.api_key_enc), session: c.session });

/**
 * Endereço que o WAHA chama quando chega mensagem ou muda a conexão. Em produção é o próprio site;
 * para testar com o WAHA no Docker e o sistema na máquina, WHATSAPP_WEBHOOK_BASE aponta para o host
 * (ex.: http://host.docker.internal:3100).
 */
export const webhookUrl = (connectionId: string) => `${(process.env.WHATSAPP_WEBHOOK_BASE || publicEnv.NEXT_PUBLIC_SITE_URL).replace(/\/+$/, "")}/api/whatsapp/webhook/${connectionId}`;

/**
 * Envia texto e registra em whatsapp_outbox. Com dedupeKey, não repete o mesmo envio.
 * Devolve a mensagem de erro (em português) ou null.
 */
export async function sendAndLog(c: StoredWhatsapp, input: { kind: "teste" | "alerta" | "relatorio"; chatId: string; chatName?: string | null; body: string; dedupeKey?: string; createdBy?: string | null }): Promise<string | null> {
  const db = createAdminClient();
  const { data: row, error } = await db
    .from("whatsapp_outbox")
    .insert({ connection_id: c.id, kind: input.kind, chat_id: input.chatId, chat_name: input.chatName ?? null, body: input.body, dedupe_key: input.dedupeKey ?? null, created_by: input.createdBy ?? null })
    .select("id")
    .single();
  if (error) return error.code === "23505" ? null : "Não foi possível registrar o envio.";
  let message: string | null = null;
  try {
    const conn = wahaConn(c);
    // A situação gravada pode estar velha (o aparelho saiu): confere no servidor antes de enviar.
    const live = await wahaSession(conn);
    if (live?.status !== "WORKING") {
      await db.from("whatsapp_connections").update({ status: live?.status ?? "STOPPED" }).eq("id", c.id);
      throw new WahaError("O WhatsApp da Extend não está conectado no servidor. Leia o QR Code em Configurações › WhatsApp.");
    }
    await wahaSendText(conn, input.chatId, input.body);
  } catch (e) {
    message = e instanceof WahaError ? e.message : "Falha ao enviar pelo WhatsApp.";
  }
  await db.from("whatsapp_outbox").update({ ok: !message, error: message }).eq("id", row.id);
  if (message) await db.from("whatsapp_connections").update({ last_error: message }).eq("id", c.id);
  return message;
}
