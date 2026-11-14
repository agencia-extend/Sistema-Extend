import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ProposalSnapshot } from "@/domain/proposals";
import { pdfResponse, signBlockImages } from "@/features/proposals/server";

export const runtime = "nodejs";

/** PDF de uma versão da proposta para quem está logado (a RLS decide quem vê). ?versao=n, padrão a mais recente. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Proposta não encontrada." }, { status: 404 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ error: "Entre no sistema para baixar a proposta." }, { status: 401 });
  const url = new URL(request.url);
  const wanted = Number(url.searchParams.get("versao"));
  let q = supabase.from("proposal_versions").select("snapshot").eq("proposal_id", id);
  q = Number.isInteger(wanted) && wanted > 0 ? q.eq("version", wanted) : q.order("version", { ascending: false }).limit(1);
  const { data, error } = await q.maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Proposta não encontrada ou sem acesso." }, { status: 404 });
  const snap = data.snapshot as ProposalSnapshot;
  try {
    return await pdfResponse(snap, await signBlockImages(supabase, snap.blocks), url.searchParams.has("baixar"));
  } catch (e) {
    console.error("[proposta-pdf]", (e as Error)?.message);
    return NextResponse.json({ error: "Não foi possível gerar o PDF agora. Tente de novo." }, { status: 500 });
  }
}
