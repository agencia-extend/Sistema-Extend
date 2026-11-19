import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWhatsapp, wahaConn } from "@/lib/whatsapp/store";
import { WahaError, wahaSendText, wahaSession } from "@/lib/whatsapp/waha";

// Mensagens automáticas das cadências (RF-CRM-06): saem pelo WhatsApp da Extend no horário do passo. Sem WhatsApp
// conectado, a ação fica com o motivo e o responsável recebe o lembrete para mandar à mão.

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runCadenceSends(opts: { budgetMs?: number; gapMs?: number } = {}) {
  const started = Date.now();
  const db = createAdminClient();
  const { data, error } = await db.rpc("cadence_due_messages", { p_limit: 40 });
  if (error) throw error;
  const rows = data ?? [];
  let sent = 0;
  let failed = 0;
  const conns = new Map<string, Awaited<ReturnType<typeof getWhatsapp>>>();
  const live = new Map<string, boolean>();
  for (const [i, r] of rows.entries()) {
    if (Date.now() - started > (opts.budgetMs ?? 40_000)) break;
    if (!conns.has(r.organization_id)) conns.set(r.organization_id, await getWhatsapp(r.organization_id));
    const c = conns.get(r.organization_id) ?? null;
    let problem: string | null = null;
    if (!c) problem = "O WhatsApp da Extend não está configurado: mande esta mensagem à mão.";
    else {
      try {
        const conn = wahaConn(c);
        if (!live.has(c.id)) live.set(c.id, (await wahaSession(conn))?.status === "WORKING");
        if (!live.get(c.id)) throw new WahaError("O WhatsApp da Extend está desconectado: mande esta mensagem à mão.");
        if (i > 0) await pause(opts.gapMs ?? 2_000);
        await wahaSendText(conn, `${r.phone}@c.us`, r.message);
      } catch (e) {
        problem = e instanceof WahaError ? e.message : "Falha ao enviar pelo WhatsApp: mande esta mensagem à mão.";
      }
    }
    const now = new Date().toISOString();
    if (problem) {
      failed++;
      await db.from("lead_activities").update({ send_error: problem.slice(0, 300) }).eq("id", r.activity_id);
    } else {
      sent++;
      await db.from("lead_activities").update({ sent_at: now, done_at: now }).eq("id", r.activity_id);
    }
  }
  return { due: rows.length, sent, failed };
}
