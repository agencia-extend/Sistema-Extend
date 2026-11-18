"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction, must } from "@/lib/actions";
import { fail, ok } from "@/domain/shared/result";
import { decrypt, encrypt } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWhatsapp, sendAndLog, wahaConn, webhookUrl } from "@/lib/whatsapp/store";
import { NO_SERVER_MESSAGE, ensureConnection } from "@/lib/whatsapp/server";
import { WahaError, wahaGroups, wahaLogout, wahaPing, wahaQr, wahaRelink, wahaRequestCode, wahaSession, wahaStartSession } from "@/lib/whatsapp/waha";
import { groupSchema, pairingSchema, serverSchema, testSchema } from "./schemas";

const PAGE = "/configuracoes/whatsapp";
/** Conectar o número e compilar: quem gerencia o atendimento (Comercial) ou as integrações (admin). */
const CONNECT = ["inbox.manage", "integrations.manage"] as const;
const refreshAll = () => {
  revalidatePath(PAGE);
  revalidatePath("/atendimento");
};
const none = z.object({});
const msg = (e: unknown, fallback: string) => (e instanceof WahaError ? e.message : fallback);

/** Endereço e chave do servidor WAHA (máquina local por túnel ou VPS). Confere antes de salvar. */
export const saveWhatsappServer = defineAction({ schema: serverSchema, permission: "integrations.manage" }, async ({ baseUrl, apiKey }, { user }) => {
  try {
    await wahaPing({ url: baseUrl, key: apiKey });
  } catch (e) {
    return fail("business_rule", msg(e, "Não foi possível falar com o servidor do WhatsApp."));
  }
  const db = createAdminClient();
  const existing = await getWhatsapp(user.organizationId);
  if (existing) {
    must(await db.from("whatsapp_connections").update({ base_url: baseUrl, api_key_enc: encrypt(apiKey), last_error: null }).eq("id", existing.id));
  } else {
    must(await db.from("whatsapp_connections").insert({
      organization_id: user.organizationId, base_url: baseUrl, api_key_enc: encrypt(apiKey), webhook_secret_enc: encrypt(randomBytes(32).toString("hex")), connected_by: user.id,
    }));
  }
  revalidatePath(PAGE);
  return ok(null, "Servidor do WhatsApp salvo. Agora conecte o número.");
});

/** Sobe a sessão (com o webhook do sistema) para mostrar o QR Code. O servidor já vem configurado. */
export const startWhatsapp = defineAction({ schema: none, permission: [...CONNECT] }, async (_, { user }) => {
  const c = await ensureConnection(user.organizationId, user.id);
  if (!c) return fail("business_rule", NO_SERVER_MESSAGE);
  try {
    await wahaStartSession(wahaConn(c), webhookUrl(c.id), decrypt(c.webhook_secret_enc));
    await createAdminClient().from("whatsapp_connections").update({ status: "STARTING", last_error: null, connected_by: user.id }).eq("id", c.id);
  } catch (e) {
    return fail("network", msg(e, "Não foi possível iniciar a conexão."));
  }
  refreshAll();
  return ok(null, "Conexão iniciada. Leia o QR Code com o celular do número da Extend.");
});

/** Sai do aparelho e gera um QR novo com o histórico ligado ("Conectar de novo e trazer tudo"). */
export const relinkWhatsapp = defineAction({ schema: none, permission: [...CONNECT] }, async (_, { user }) => {
  const c = await getWhatsapp(user.organizationId);
  if (!c) return fail("business_rule", NO_SERVER_MESSAGE);
  try {
    await wahaRelink(wahaConn(c), webhookUrl(c.id), decrypt(c.webhook_secret_enc));
  } catch (e) {
    return fail("network", msg(e, "Não foi possível preparar o QR Code."));
  }
  await createAdminClient().from("whatsapp_connections").update({ status: "STARTING", last_error: null, me_id: null, me_name: null, connected_by: user.id }).eq("id", c.id);
  refreshAll();
  return ok(null);
});

/** Situação atual e, se estiver esperando, o QR Code (a tela consulta a cada poucos segundos). */
export const whatsappState = defineAction({ schema: none, permission: [...CONNECT] }, async (_, { user }) => {
  const c = await getWhatsapp(user.organizationId);
  if (!c) return ok({ status: "SEM_SERVIDOR", qr: null as string | null, me: null as string | null });
  try {
    const conn = wahaConn(c);
    const s = await wahaSession(conn);
    const status = s?.status ?? "STOPPED";
    const me = s?.me?.id ? `${s.me.pushName ?? ""} (${s.me.id.replace(/@.*/, "")})`.trim() : null;
    if (status !== c.status) {
      await createAdminClient()
        .from("whatsapp_connections")
        .update({ status, ...(status === "WORKING" ? { me_id: s?.me?.id ?? null, me_name: s?.me?.pushName ?? null, last_error: null } : {}) })
        .eq("id", c.id);
      if (status === "WORKING") refreshAll();
    }
    const qr = status === "SCAN_QR_CODE" ? await wahaQr(conn).catch(() => null) : null;
    return ok({ status, qr, me });
  } catch (e) {
    return fail("network", msg(e, "Não foi possível consultar o servidor do WhatsApp."));
  }
});

/** Alternativa ao QR Code: código de 8 letras digitado no celular (Aparelhos conectados › Conectar com número). */
export const requestPairingCode = defineAction({ schema: pairingSchema, permission: [...CONNECT] }, async ({ phone }, { user }) => {
  const c = await getWhatsapp(user.organizationId);
  if (!c) return fail("business_rule", "Salve o servidor e inicie a conexão primeiro.");
  let digits = phone.replace(/\D/g, "");
  if (digits.length <= 11) digits = `55${digits}`;
  try {
    const code = await wahaRequestCode(wahaConn(c), digits);
    if (!code) return fail("business_rule", "O servidor não devolveu o código. Tente pelo QR Code.");
    return ok({ code }, "Digite o código no celular.");
  } catch (e) {
    return fail("network", msg(e, "Não foi possível pedir o código."));
  }
});

/** Busca os grupos do número e grava (novos entram sem cliente). */
export const refreshGroups = defineAction({ schema: none, permission: "integrations.manage" }, async (_, { user }) => {
  const c = await getWhatsapp(user.organizationId);
  if (!c || c.status !== "WORKING") return fail("business_rule", "Conecte o número antes de buscar os grupos.");
  let groups: { id: string; name: string }[];
  try {
    groups = await wahaGroups(wahaConn(c));
  } catch (e) {
    return fail("network", msg(e, "Não foi possível buscar os grupos."));
  }
  if (groups.length) {
    must(await createAdminClient().from("whatsapp_groups").upsert(
      groups.map((g) => ({ connection_id: c.id, jid: g.id, name: g.name, last_seen_at: new Date().toISOString() })),
      { onConflict: "connection_id,jid" },
    ));
  }
  revalidatePath(PAGE);
  return ok(null, `${groups.length} ${groups.length === 1 ? "grupo encontrado" : "grupos encontrados"}.`);
});

/** Liga o grupo a um cliente e/ou marca como grupo de alertas internos ou de relatórios (a RPC confere no banco). */
export const saveGroup = defineAction({ schema: groupSchema, permission: "integrations.manage" }, async ({ id, clientId, alerts, reports }) => {
  const supabase = await createClient();
  must(await supabase.rpc("save_whatsapp_group", { p_id: id, p_client: clientId as string, p_alerts: alerts, p_reports: reports }));
  revalidatePath(PAGE);
  return ok(null, "Grupo salvo.");
});

/** Mensagem de teste no grupo escolhido. */
export const sendTestMessage = defineAction({ schema: testSchema, permission: "integrations.manage" }, async ({ groupId }, { user }) => {
  const c = await getWhatsapp(user.organizationId);
  if (!c) return fail("business_rule", "Conecte o WhatsApp primeiro.");
  const { data: g } = await createAdminClient().from("whatsapp_groups").select("jid, name").eq("id", groupId).eq("connection_id", c.id).maybeSingle();
  if (!g) return fail("not_found", "Grupo não encontrado.");
  const error = await sendAndLog(c, { kind: "teste", chatId: g.jid, chatName: g.name, body: `✅ Teste do Sistema Extend: o WhatsApp está conectado e enviando para "${g.name}".`, createdBy: user.id });
  revalidatePath(PAGE);
  return error ? fail("network", error) : ok(null, `Mensagem de teste enviada para "${g.name}".`);
});

/** Desconecta o número (sai do aparelho). O endereço e a chave do servidor continuam salvos. */
export const disconnectWhatsapp = defineAction({ schema: none, permission: "integrations.manage" }, async (_, { user }) => {
  const c = await getWhatsapp(user.organizationId);
  if (!c) return fail("not_found", "Nada para desconectar.");
  await wahaLogout(wahaConn(c)).catch(() => null);
  must(await createAdminClient().from("whatsapp_connections").update({ status: "STOPPED", me_id: null, me_name: null }).eq("id", c.id));
  refreshAll();
  return ok(null, "WhatsApp desconectado.");
});
