import { NextResponse } from "next/server";
import { getPublicProposal, pdfResponse } from "@/features/proposals/server";

export const runtime = "nodejs";

/** PDF da versão enviada, pelo link público. */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = await getPublicProposal(token);
  if (!p) return NextResponse.json({ error: "Proposta não encontrada." }, { status: 404 });
  try {
    return await pdfResponse(p.snapshot, p.images, true);
  } catch (e) {
    console.error("[proposta-pdf-publica]", (e as Error)?.message);
    return NextResponse.json({ error: "Não foi possível gerar o PDF agora. Tente de novo." }, { status: 500 });
  }
}
