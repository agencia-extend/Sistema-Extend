import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Encerra a sessão local (usado quando a conta foi desativada) e volta ao login.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  const motivo = request.nextUrl.searchParams.get("motivo");
  const dest = request.nextUrl.clone();
  dest.pathname = "/login";
  dest.search = motivo === "desativado" ? "?motivo=desativado" : "?motivo=saiu";
  const res = NextResponse.redirect(dest);
  res.cookies.delete("ext_lembrar");
  res.cookies.delete("ext_sessao");
  return res;
}
