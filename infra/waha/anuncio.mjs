// Avisa o Sistema Extend do endereço público do túnel (Cloudflare Quick Tunnel), que muda quando o túnel reinicia.
// Roda no contêiner extend-waha-anuncio (compose.yaml, perfil "tunnel"). Assina com HMAC-SHA256 pela chave do WAHA:
// o sistema só aceita o endereço se a assinatura bater e se o WAHA responder nele com essa chave.
// Nunca escreve a chave no log.
import { createHmac } from "node:crypto";

const SITE = (process.env.SITE_URL || "https://hub.agenciaextend.com.br").replace(/\/+$/, "");
const KEY = (process.env.WAHA_API_KEY || "").trim();
const METRICS = process.env.TUNNEL_METRICS || "http://tunnel:2000";
const EVERY_MS = 30_000;
const REFRESH_MS = 10 * 60_000; // reenvia de tempos em tempos, caso o sistema tenha perdido o endereço

if (!KEY) {
  console.error("[anuncio] WAHA_API_KEY vazio no infra/waha/.env: nada a fazer.");
  process.exit(1);
}

let sent = "";
let sentAt = 0;

async function hostname() {
  const res = await fetch(`${METRICS}/quicktunnel`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) return null;
  const body = await res.json().catch(() => ({}));
  return typeof body.hostname === "string" && body.hostname ? body.hostname : null;
}

async function tick() {
  let host;
  try {
    host = await hostname();
  } catch {
    host = null;
  }
  if (!host) return console.log("[anuncio] túnel ainda sem endereço; tentando de novo.");
  const url = `https://${host}`;
  if (url === sent && Date.now() - sentAt < REFRESH_MS) return;
  const raw = JSON.stringify({ url, at: Date.now() });
  try {
    const res = await fetch(`${SITE}/api/whatsapp/servidor`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-extend-signature": createHmac("sha256", KEY).update(raw).digest("hex") },
      body: raw,
      signal: AbortSignal.timeout(20000),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      sent = url;
      sentAt = Date.now();
      console.log(`[anuncio] ${body.changed ? "endereço novo enviado" : "endereço confirmado"}: ${url}`);
    } else {
      console.log(`[anuncio] o sistema recusou (${res.status}): ${body.error ?? "sem detalhe"}`);
    }
  } catch {
    console.log("[anuncio] não consegui falar com o sistema; tentando de novo.");
  }
}

await tick();
setInterval(tick, EVERY_MS);
