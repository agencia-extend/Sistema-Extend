import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/push";
import { syncMetaAccounts } from "@/lib/ads/meta-sync";
import { forwardAdAlerts } from "@/lib/whatsapp/alerts";
import { sendWeeklyReports } from "@/lib/whatsapp/reports";
import { syncSocial } from "@/lib/social/meta-social";
import { runPublisher } from "@/lib/social/publisher";
import { runWhatsappImports } from "@/lib/whatsapp/history";

// Relógio do banco: pg_cron → pg_net → POST /api/jobs/<job> com "Authorization: Bearer <JOBS_TOKEN>".
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const expected = process.env.JOBS_TOKEN;
  const got = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

async function notificationsJob() {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_pending_pushes", { p_limit: 200 });
  if (error) throw error;
  const rows = (data ?? []) as { id: string; user_id: string; title: string; body: string | null; href: string | null; kind: string }[];
  const res = await sendPush(
    rows.map((n) => ({ key: n.id, userId: n.user_id, payload: { title: n.title, body: n.body, href: n.href, tag: n.kind } })),
  );
  const { error: finErr } = await admin.rpc("finish_pushes", { p_sent: res.sent, p_skipped: res.skipped, p_failed: res.failed });
  if (finErr) throw finErr;
  return { claimed: rows.length, sent: res.sent.length, skipped: res.skipped.length, failed: res.failed.length };
}

const JOBS: Record<string, () => Promise<unknown>> = {
  notifications: notificationsJob,
  // Anúncios da Meta (RF-ADS-03): as contas mais atrasadas primeiro, dentro de ~45 s; o resto na próxima.
  "ads-sync": () => syncMetaAccounts({ trigger: "cron", budgetMs: 45_000 }),
  // Alertas de anúncios no grupo interno do WhatsApp (RF-ALE-02).
  "whatsapp-alerts": forwardAdAlerts,
  // Relatório semanal de anúncios de cada cliente no grupo de relatórios (RF-REL-01).
  "whatsapp-reports": sendWeeklyReports,
  // Páginas e Instagram dos clientes e as últimas publicações (RF-CON-02).
  "social-sync": () => syncSocial({ budgetMs: 45_000 }),
  // Publicações programadas no Facebook e no Instagram (RF-CON-03).
  "publish-posts": runPublisher,
  // "Compilar conversas" do WhatsApp continua com a tela fechada.
  "whatsapp-import": () => runWhatsappImports(45_000),
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ job: string }> }) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { job } = await params;
  const run = JOBS[job];
  if (!run) return NextResponse.json({ error: "job desconhecido" }, { status: 404 });
  try {
    const result = await run();
    return NextResponse.json({ ok: true, job, result });
  } catch (e) {
    console.error(`[jobs/${job}]`, (e as Error)?.message ?? e);
    return NextResponse.json({ ok: false, job, error: "falha ao executar o job" }, { status: 500 });
  }
}
