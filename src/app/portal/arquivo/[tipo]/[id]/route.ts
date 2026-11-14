import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, PORTAL_PREVIEW_COOKIE } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { portalFilePath } from "@/features/portal/queries";

/**
 * Baixar arquivo da área do cliente: o banco confere se o arquivo é do cliente e está compartilhado
 * (portal_file_path) e só então o servidor gera um link de 5 minutos.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ tipo: string; id: string }> }) {
  const { tipo, id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const clientId = user.portalClientId ?? request.cookies.get(PORTAL_PREVIEW_COOKIE)?.value ?? "";
  if (!/^[0-9a-f-]{36}$/.test(clientId) || !/^[0-9a-f-]{36}$/.test(id) || (tipo !== "arquivo" && tipo !== "versao")) {
    return new NextResponse("Arquivo não encontrado.", { status: 404 });
  }
  const path = await portalFilePath(clientId, tipo, id);
  if (!path || !process.env.SUPABASE_SECRET_KEY) return new NextResponse("Arquivo não encontrado ou não compartilhado com você.", { status: 404 });
  const { data, error } = await createAdminClient().storage.from("anexos").createSignedUrl(path, 300, {
    // Nome sem o prefixo aleatório do armazenamento.
    download: request.nextUrl.searchParams.has("baixar") ? (path.split("/").pop() ?? "arquivo").replace(/^[0-9a-f-]{36}-/, "") : false,
  });
  if (error || !data) return new NextResponse("Não foi possível abrir o arquivo agora. Tente de novo em instantes.", { status: 502 });
  return NextResponse.redirect(data.signedUrl);
}
