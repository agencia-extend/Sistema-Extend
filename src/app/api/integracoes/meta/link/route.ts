import { NextResponse, type NextRequest } from "next/server";
import { configured } from "@/lib/integrations/config";
import { getClientLink } from "@/lib/integrations/client-links";
import { metaAuthUrl } from "@/lib/integrations/meta";
import { startLinkOAuth } from "@/lib/integrations/oauth";

/** /api/integracoes/meta/link?t=<código>: o cliente sai da página do link para o login da Meta. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t") ?? "";
  const link = await getClientLink(token);
  if (!link) return NextResponse.redirect(new URL("/conectar/invalido", request.url));
  if (link.state !== "aberto") return NextResponse.redirect(new URL(`/conectar/${token}`, request.url));
  if (!configured("meta")) return NextResponse.redirect(new URL(`/conectar/${token}?erro=configuracao`, request.url));
  return startLinkOAuth(request, token, metaAuthUrl);
}
