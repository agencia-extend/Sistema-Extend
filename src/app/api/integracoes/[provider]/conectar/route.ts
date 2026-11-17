import type { NextRequest } from "next/server";
import { googleAuthUrl } from "@/lib/integrations/google";
import { metaAuthUrl } from "@/lib/integrations/meta";
import { startOAuth } from "@/lib/integrations/oauth";

/**
 * /api/integracoes/meta/conectar?para=agencia|pessoal|cliente(&cliente=<id>) e
 * /api/integracoes/google/conectar?para=agencia|agenda
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const q = request.nextUrl.searchParams;
  const para = q.get("para") ?? "";
  const key = para === "cliente" ? `${provider}:cliente:${q.get("cliente") ?? ""}` : `${provider}:${para}`;
  return startOAuth(request, key, (state, t) => (t.provider === "meta" ? metaAuthUrl(state) : googleAuthUrl(state, t.purpose)));
}
