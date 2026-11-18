import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validServerUrl } from "@/domain/whatsapp/history";
import { allowLocalServer, saveServer } from "@/lib/whatsapp/server";
import { getWhatsapp, wahaConn } from "@/lib/whatsapp/store";
import { wahaPing } from "@/lib/whatsapp/waha";

// O túnel do WAHA (infra/waha, serviço "anuncio") avisa aqui o endereço público dele sempre que muda.
// Assinado com HMAC-SHA256 pela própria chave do servidor (WAHA_API_KEY): só quem tem a chave troca o endereço.
export const dynamic = "force-dynamic";

const MAX_SKEW_MS = 5 * 60_000;

function validSignature(raw: string, header: string | null, key: string) {
  if (!header) return false;
  const expected = Buffer.from(createHmac("sha256", key).update(raw, "utf8").digest("hex"));
  const got = Buffer.from(header);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

export async function POST(request: NextRequest) {
  const key = process.env.WAHA_API_KEY?.trim();
  if (!key) return NextResponse.json({ error: "servidor do WhatsApp não configurado no sistema" }, { status: 503 });
  const raw = await request.text();
  if (raw.length > 2000) return NextResponse.json({ error: "grande demais" }, { status: 413 });
  if (!validSignature(raw, request.headers.get("x-extend-signature"), key)) return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });

  let body: { url?: unknown; at?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "json inválido" }, { status: 400 });
  }
  if (typeof body.at !== "number" || Math.abs(Date.now() - body.at) > MAX_SKEW_MS) return NextResponse.json({ error: "aviso vencido" }, { status: 401 });
  const url = typeof body.url === "string" ? validServerUrl(body.url, allowLocalServer()) : null;
  if (!url) return NextResponse.json({ error: "endereço inválido" }, { status: 400 });

  // Confere se o servidor responde nesse endereço com a chave antes de trocar.
  try {
    await wahaPing({ url, key });
  } catch {
    return NextResponse.json({ error: "o servidor não respondeu nesse endereço" }, { status: 502 });
  }

  const { data: org } = await createAdminClient().from("organizations").select("id").order("created_at").limit(1).single();
  if (!org) return NextResponse.json({ error: "sem organização" }, { status: 500 });
  const current = await getWhatsapp(org.id);
  if (current && current.base_url === url && wahaConn(current).key === key) return NextResponse.json({ ok: true, changed: false });
  await saveServer(org.id, url, key, null);
  return NextResponse.json({ ok: true, changed: true });
}
