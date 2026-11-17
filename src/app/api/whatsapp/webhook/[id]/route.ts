import { NextResponse, type NextRequest } from "next/server";
import { decrypt } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { validWahaSignature } from "@/lib/whatsapp/waha";

// Eventos do WAHA (RF-WPP-01/03): situação da conexão e mensagens. Assinados com HMAC-SHA512 pelo segredo da conexão.
export const dynamic = "force-dynamic";

type Payload = { id?: string; from?: string; to?: string; fromMe?: boolean; participant?: string; body?: string; timestamp?: number; hasMedia?: boolean; type?: string; _data?: { notifyName?: string; pushName?: string } };
type Event = { event?: string; session?: string; me?: { id?: string; pushName?: string } | null; payload?: Payload & { status?: string } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "conexão inválida" }, { status: 404 });
  const raw = await request.text();
  if (raw.length > 1_000_000) return NextResponse.json({ error: "grande demais" }, { status: 413 });
  const db = createAdminClient();
  const { data: conn } = await db.from("whatsapp_connections").select("id, session, webhook_secret_enc").eq("id", id).maybeSingle();
  if (!conn) return NextResponse.json({ error: "conexão inválida" }, { status: 404 });
  let secret = "";
  try {
    secret = decrypt(conn.webhook_secret_enc);
  } catch {
    return NextResponse.json({ error: "segredo ilegível" }, { status: 500 });
  }
  if (!validWahaSignature(raw, request.headers.get("x-webhook-hmac"), secret)) return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });

  let ev: Event;
  try {
    ev = JSON.parse(raw) as Event;
  } catch {
    return NextResponse.json({ error: "json inválido" }, { status: 400 });
  }
  if (ev.session && ev.session !== conn.session) return NextResponse.json({ ok: true, ignored: "sessão" });
  const now = new Date().toISOString();

  if (ev.event === "session.status" && ev.payload?.status) {
    const status = String(ev.payload.status).slice(0, 40);
    await db.from("whatsapp_connections").update({
      status,
      last_event_at: now,
      ...(status === "WORKING" ? { me_id: ev.me?.id ?? null, me_name: ev.me?.pushName ?? null, last_error: null } : {}),
      ...(status === "FAILED" ? { last_error: "A conexão com o WhatsApp caiu. Leia o QR Code de novo em Configurações › WhatsApp." } : {}),
    }).eq("id", conn.id);
    return NextResponse.json({ ok: true });
  }

  if ((ev.event === "message.any" || ev.event === "message") && ev.payload?.id) {
    const p = ev.payload;
    const chat = p.fromMe ? p.to : p.from;
    if (!chat || chat.endsWith("@broadcast") || chat.endsWith("@newsletter")) return NextResponse.json({ ok: true, ignored: "chat" });
    await db.from("whatsapp_messages").upsert({
      connection_id: conn.id,
      wamid: String(p.id).slice(0, 200),
      chat_id: chat.slice(0, 200),
      from_me: Boolean(p.fromMe),
      author: (p.participant ?? (p.fromMe ? null : p.from) ?? null)?.slice(0, 200) ?? null,
      author_name: (p._data?.notifyName ?? p._data?.pushName ?? null)?.slice(0, 200) ?? null,
      body: p.body ? String(p.body).slice(0, 8000) : null,
      kind: p.hasMedia ? "media" : "text",
      sent_at: p.timestamp ? new Date(p.timestamp * 1000).toISOString() : now,
    }, { onConflict: "connection_id,wamid", ignoreDuplicates: true });
    await db.from("whatsapp_connections").update({ last_event_at: now }).eq("id", conn.id);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: true, ignored: ev.event ?? "sem evento" });
}
