import "server-only";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAndLog, type StoredWhatsapp } from "./store";

/**
 * RF-ALE-02: alertas de anúncios (saldo, conta parada, reprovação, conexão) no grupo de alertas internos.
 * Um envio por chave de deduplicação (o mesmo alerta vai para várias pessoas no sino, mas uma vez no grupo).
 * Só alertas das últimas 2 horas, para não despejar o histórico quando o grupo for marcado.
 */
export async function forwardAdAlerts() {
  const db = createAdminClient();
  const { data: conns } = await db.from("whatsapp_connections").select("id, organization_id, base_url, api_key_enc, session, webhook_secret_enc, status").eq("status", "WORKING");
  const out: { connection: string; sent: number; failed: number }[] = [];
  for (const c of (conns ?? []) as StoredWhatsapp[]) {
    const { data: group } = await db.from("whatsapp_groups").select("jid, name").eq("connection_id", c.id).eq("is_alerts", true).maybeSingle();
    if (!group) continue;
    const since = new Date(Date.now() - 2 * 3600_000).toISOString();
    const { data: rows } = await db
      .from("notifications")
      .select("dedupe_key, title, body, href, created_at")
      .eq("organization_id", c.organization_id)
      .eq("kind", "ad_alert")
      .gte("created_at", since)
      .not("dedupe_key", "is", null)
      .order("created_at", { ascending: true })
      .limit(500);
    const seen = new Set<string>();
    let sent = 0;
    let failed = 0;
    for (const n of rows ?? []) {
      if (seen.has(n.dedupe_key!) || seen.size >= 20) continue;
      seen.add(n.dedupe_key!);
      const link = n.href ? `\n${publicEnv.NEXT_PUBLIC_SITE_URL}${n.href}` : "";
      const error = await sendAndLog(c, { kind: "alerta", chatId: group.jid, chatName: group.name, body: `⚠️ *${n.title}*\n${n.body ?? ""}${link}`.trim(), dedupeKey: `alerta:${n.dedupe_key}` });
      if (error) failed++;
      else sent++;
    }
    out.push({ connection: c.id, sent, failed });
  }
  return out;
}
