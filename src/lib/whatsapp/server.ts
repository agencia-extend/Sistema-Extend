import "server-only";
import { randomBytes } from "node:crypto";
import { encrypt } from "@/lib/crypto";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { validServerUrl } from "@/domain/whatsapp/history";
import { getWhatsapp, type StoredWhatsapp } from "./store";

// Servidor do WhatsApp já configurado no sistema (como no HubSystem): quem conecta só lê o QR Code.
// A chave vem de WAHA_API_KEY (Vercel). O endereço vem do túnel, que se anuncia sozinho em /api/whatsapp/servidor,
// ou de WAHA_URL (endereço fixo, na VPS), ou do que o admin salvou em Configurações › WhatsApp.

/** Endereço local só vale quando o próprio sistema roda na máquina (testes). */
export const allowLocalServer = () => /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(publicEnv.NEXT_PUBLIC_SITE_URL);

export const NO_SERVER_MESSAGE =
  "O servidor do WhatsApp da Extend não está ligado. Na máquina do servidor, abra o Docker e rode \"docker compose --profile tunnel up -d\" na pasta infra/waha; em até 1 minuto o endereço chega sozinho.";

/** Grava (ou atualiza) o servidor da organização. O número conectado continua o mesmo. */
export async function saveServer(organizationId: string, url: string, apiKey: string, userId: string | null) {
  const db = createAdminClient();
  const existing = await getWhatsapp(organizationId);
  if (existing) {
    const { error } = await db.from("whatsapp_connections").update({ base_url: url, api_key_enc: encrypt(apiKey), last_error: null }).eq("id", existing.id);
    if (error) throw error;
    return existing.id;
  }
  const { data, error } = await db
    .from("whatsapp_connections")
    .insert({ organization_id: organizationId, base_url: url, api_key_enc: encrypt(apiKey), webhook_secret_enc: encrypt(randomBytes(32).toString("hex")), connected_by: userId })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/**
 * A conexão da organização. Sem nenhuma ainda, cria com o servidor de WAHA_URL + WAHA_API_KEY (endereço fixo).
 * null = nenhum servidor conhecido (o túnel ainda não se anunciou).
 */
export async function ensureConnection(organizationId: string, userId: string): Promise<StoredWhatsapp | null> {
  const existing = await getWhatsapp(organizationId);
  if (existing) return existing;
  const url = process.env.WAHA_URL ? validServerUrl(process.env.WAHA_URL, allowLocalServer()) : null;
  const key = process.env.WAHA_API_KEY?.trim();
  if (!url || !key) return null;
  await saveServer(organizationId, url, key, userId);
  return getWhatsapp(organizationId);
}
