import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, PORTAL_PREVIEW_COOKIE } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

/** "Ver como o cliente": a equipe que vê o cliente abre a área do cliente dele (só leitura). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const back = (path: string) => NextResponse.redirect(new URL(path, request.url));
  if (!user || user.portalClientId || !user.permissions["clients.read"] || !/^[0-9a-f-]{36}$/.test(id)) return back("/inicio");
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("id").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!data) return back("/clientes");
  const res = back("/portal");
  res.cookies.set(PORTAL_PREVIEW_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:", path: "/", maxAge: 2 * 3600 });
  return res;
}
