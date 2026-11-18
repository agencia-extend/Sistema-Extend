import { NextResponse, type NextRequest } from "next/server";
import { periodRange, type Period } from "@/domain/ads";
import { lastWeek, reportTotals } from "@/domain/ads/report";
import { todayKey } from "@/domain/media";
import { formatDateTime } from "@/domain/shared/dates";
import { renderAdsReportPdf } from "@/features/ads/pdf/ads-report-pdf";
import { getCurrentUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { clientReportData, reportFileName } from "@/lib/whatsapp/reports";

export const maxDuration = 60;
const PERIODS = ["hoje", "ontem", "7d", "30d", "mes", "semana"] as const;

/** RF-REL-05: relatório de anúncios do cliente em PDF (período da tela ou a semana passada). Números lidos com a RLS da pessoa. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });
  if (!user.permissions["ads.read"]) return NextResponse.json({ error: "Você não tem acesso aos anúncios." }, { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
  const raw = req.nextUrl.searchParams.get("periodo") ?? "semana";
  const period = (PERIODS as readonly string[]).includes(raw) ? (raw as (typeof PERIODS)[number]) : "semana";

  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("id, name").eq("id", id).maybeSingle();
  if (!client) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  const today = todayKey(new Date());
  const range = period === "semana" ? lastWeek(today) : periodRange(period as Period, today);
  const data = await clientReportData(client, range);
  if (!data.accounts.length) return NextResponse.json({ error: "Você não vê as contas de anúncio deste cliente." }, { status: 403 });
  if (reportTotals(data).spend_cents <= 0) return NextResponse.json({ error: "Sem gasto no período: não há o que relatar." }, { status: 422 });

  const pdf = await renderAdsReportPdf(data, formatDateTime(new Date()));
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${reportFileName(client.name, range)}"`,
      "cache-control": "private, no-store",
    },
  });
}
