import { NextResponse, type NextRequest } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getCurrentUser } from "@/lib/auth/dal";
import { listLibrary } from "@/features/creatives/queries";
import { publicEnv } from "@/lib/env";
import { libraryCsv, pdfSafe, type ExportRow } from "@/domain/creatives/export";
import { CREATIVE_FORMAT_LABEL, LIBRARY_STATUS_LABEL } from "@/domain/creatives";
import { todayKey } from "@/domain/media";
import { costPerResult, creativeKpis, creativeResults, monthLabel, perfRange, topCreatives } from "@/domain/creatives/performance";
import { getPerformance } from "@/features/creatives/performance";
import { formatBRL } from "@/domain/shared/money";

const PERMS = ["creatives.request.create", "creatives.produce", "creatives.review", "creatives.library.manage"] as const;

/**
 * Relatório de criativos do mês (RF-BIB-05) em CSV ou PDF, com o link de cada criativo no sistema. Quem vê a
 * performance recebe também os números do mês e os criativos que tiveram gasto nele (mesmo aprovados antes).
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });
  if (!PERMS.some((p) => user.permissions[p])) return NextResponse.json({ error: "Você não tem acesso à biblioteca." }, { status: 403 });

  const q = req.nextUrl.searchParams;
  const month = /^\d{4}-\d{2}$/.test(q.get("mes") ?? "") ? q.get("mes")! : todayKey(new Date()).slice(0, 7);
  const all = await listLibrary();
  const canPerf = Boolean(user.permissions["creatives.performance.read"]);
  const perf = canPerf ? await getPerformance(all.map((i) => i.id), perfRange(month as `${number}-${number}`, todayKey(new Date()))) : new Map();
  const items = all.filter((i) => i.approvedAt.slice(0, 7) === month || (perf.get(i.id)?.spendCents ?? 0) > 0);
  const rows: ExportRow[] = items.map((i) => ({ ...i, link: `${publicEnv.NEXT_PUBLIC_SITE_URL}/criativos/${i.taskId}`, totals: perf.get(i.id) ?? null }));
  const file = `biblioteca-criativos-${month}`;

  if (q.get("formato") === "pdf") {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    let page = pdf.addPage([595, 842]);
    let y = 800;
    const line = (text: string, size = 10, f = font, color = rgb(0.06, 0.09, 0.15)) => {
      if (y < 50) {
        page = pdf.addPage([595, 842]);
        y = 800;
      }
      page.drawText(pdfSafe(text).slice(0, 110), { x: 40, y, size, font: f, color });
      y -= size + 6;
    };
    line(`Relatório de criativos - ${monthLabel(month)}`, 16, bold);
    line(`Agência Extend · ${rows.length} criativo(s) aprovado(s) ou no ar no mês`, 10, font, rgb(0.32, 0.38, 0.46));
    y -= 8;
    if (!rows.length) line("Nenhum criativo aprovado ou com gasto neste mês.");
    const top = topCreatives(items, perf);
    if (top.length) {
      line("Top criativos do mês", 12, bold, rgb(0.11, 0.54, 0.9));
      top.forEach((t, n) => line(`${n + 1}. ${t.angle} (${t.clientName}): ${creativeResults(t.totals)} resultados${costPerResult(t.totals) !== null ? `, ${formatBRL(costPerResult(t.totals))} cada` : ""}`, 10));
      y -= 8;
    }
    for (const r of rows) {
      line(r.angle, 12, bold);
      line(`${r.clientName} · ${CREATIVE_FORMAT_LABEL[r.format]} · ${r.campaign} · ${LIBRARY_STATUS_LABEL[r.status]}`, 9, font, rgb(0.32, 0.38, 0.46));
      if (r.totals) {
        const k = creativeKpis(r.totals);
        const cpr = costPerResult(r.totals);
        line(`Investimento ${formatBRL(r.totals.spendCents)} · CTR ${k.ctr === null ? "-" : (k.ctr * 100).toFixed(2).replace(".", ",") + "%"} · ${creativeResults(r.totals)} resultados${cpr !== null ? ` a ${formatBRL(cpr)}` : ""}`, 9, bold);
      }
      if (r.headline) line(`Título: ${r.headline}`, 9);
      if (r.primaryText) for (let i = 0; i < Math.min(r.primaryText.length, 440); i += 105) line(r.primaryText.slice(i, i + 105), 9);
      line(r.link, 8, font, rgb(0.08, 0.44, 0.77));
      y -= 8;
    }
    const bytes = await pdf.save();
    return new NextResponse(Buffer.from(bytes), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${file}.pdf"`, "Cache-Control": "no-store" },
    });
  }
  return new NextResponse(libraryCsv(rows, canPerf), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${file}.csv"`, "Cache-Control": "no-store" },
  });
}
