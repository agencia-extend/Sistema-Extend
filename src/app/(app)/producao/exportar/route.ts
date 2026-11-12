import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { productionData } from "@/features/media/queries";
import { todayKey } from "@/domain/media";
import { buildReport, peopleCsv } from "@/domain/media/report";

const isDay = (v: string | null): v is string => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));

/** CSV da produção por pessoa no período (mesmos números da tela Controle geral). */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });
  if (!user.permissions["dashboards.read"]) return NextResponse.json({ error: "Você não tem permissão para este relatório." }, { status: 403 });

  const q = req.nextUrl.searchParams;
  const today = todayKey();
  let de = isDay(q.get("de")) ? q.get("de")! : `${today.slice(0, 8)}01`;
  let ate = isDay(q.get("ate")) ? q.get("ate")! : today;
  if (de > ate) [de, ate] = [ate, de];

  const data = await productionData(de, ate);
  const report = buildReport(data.finished, data.open, data.months, data.slots, { from: de, to: ate });
  return new NextResponse(peopleCsv(report.people), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="producao-${de}-a-${ate}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
