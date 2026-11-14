import { NextResponse, type NextRequest } from "next/server";
import { PORTAL_PREVIEW_COOKIE } from "@/lib/auth/dal";

/** Sai da prévia e volta para a aba "Área do cliente" do cliente que estava sendo visto. */
export async function GET(request: NextRequest) {
  const id = request.cookies.get(PORTAL_PREVIEW_COOKIE)?.value;
  const dest = id && /^[0-9a-f-]{36}$/.test(id) ? `/clientes/${id}/area-do-cliente` : "/clientes";
  const res = NextResponse.redirect(new URL(dest, request.url));
  res.cookies.delete(PORTAL_PREVIEW_COOKIE);
  return res;
}
