import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rotas acessíveis sem sessão.
const PUBLIC_PATHS = [
  "/login",
  "/recuperar-senha",
  "/convite",
  "/auth/confirm",
  "/sair",
  "/offline",
  "/api/jobs",
  "/aprovar",
  "/proposta",
  "/avaliar-leads",
  "/privacidade",
  "/termos",
];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
          for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
        },
      },
    },
  );

  // Valida o JWT e renova a sessão. Não colocar código entre a criação do cliente e esta chamada.
  const { data } = await supabase.auth.getClaims();
  let signedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  // Sem "manter conectado": o cookie de sessão some quando o navegador fecha; aí a sessão termina.
  if (signedIn && request.cookies.get("ext_lembrar")?.value === "0" && !request.cookies.get("ext_sessao")) {
    await supabase.auth.signOut({ scope: "local" });
    signedIn = false;
    if (!isPublic(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "?motivo=sessao";
      const res = copyCookies(response, NextResponse.redirect(url));
      res.cookies.delete("ext_lembrar");
      return res;
    }
    response.cookies.delete("ext_lembrar");
  }

  if (!signedIn && !isPublic(pathname) && pathname !== "/") {
    if (pathname.startsWith("/api/")) {
      return copyCookies(response, NextResponse.json({ error: "unauthenticated" }, { status: 401 }));
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return copyCookies(response, NextResponse.redirect(url));
  }

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = signedIn ? "/inicio" : "/login";
    url.search = "";
    return copyCookies(response, NextResponse.redirect(url));
  }

  if (signedIn && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/inicio";
    url.search = "";
    return copyCookies(response, NextResponse.redirect(url));
  }

  return response;
}

function copyCookies(from: NextResponse, to: NextResponse) {
  for (const cookie of from.cookies.getAll()) to.cookies.set(cookie);
  return to;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
