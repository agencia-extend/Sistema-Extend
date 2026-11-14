import { NextResponse, type NextRequest } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getCurrentUser } from "@/lib/auth/dal";
import { listLibrary } from "@/features/creatives/queries";
import { publicEnv } from "@/lib/env";
import { libraryCsv, pdfSafe, type ExportRow } from "@/domain/creatives/export";
import { CREATIVE_FORMAT_LABEL, LIBRARY_STATUS_LABEL } from "@/domain/creatives";
import { todayKey } from "@/domain/media";

const PERMS = ["creatives.request.create", "creatives.produce", "creatives.review", "creatives.library.manage"] as const;

/** Biblioteca do mês em CSV ou PDF, com o link de cada criativo no sistema. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });
  if (!PERMS.some((p) => user.permissions[p])) return NextResponse.json({ error: "Você não tem acesso à biblioteca." }, { status: 403 });

  const q = req.nextUrl.searchParams;
  const month = /^\d{4}-\d{2}$/.test(q.get("mes") ?? "") ? q.get("mes")! : todayKey(new Date()).slice(0, 7);
  const items = (await listLibrary()).filter((i) => i.approvedAt.slice(0, 7) === month);
  const rows: ExportRow[] = items.map((i) => ({ ...i, link: `${publicEnv.NEXT_PUBLIC_SITE_URL}/criativos/${i.taskId}` }));
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
    line(`Biblioteca de criativos - ${month.slice(5)}/${month.slice(0, 4)}`, 16, bold);
    line(`Agência Extend · ${rows.length} criativo(s) aprovado(s)`, 10, font, rgb(0.32, 0.38, 0.46));
    y -= 8;
    if (!rows.length) line("Nenhum criativo aprovado neste mês.");
    for (const r of rows) {
      line(r.angle, 12, bold);
      line(`${r.clientName} · ${CREATIVE_FORMAT_LABEL[r.format]} · ${r.campaign} · ${LIBRARY_STATUS_LABEL[r.status]}`, 9, font, rgb(0.32, 0.38, 0.46));
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
  return new NextResponse(libraryCsv(rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${file}.csv"`, "Cache-Control": "no-store" },
  });
}
