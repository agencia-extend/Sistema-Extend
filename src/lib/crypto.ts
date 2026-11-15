import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Tokens de terceiros: AES-256-GCM com a chave TOKEN_ENCRYPTION_KEY (32 bytes em base64).
// Formato gravado: iv.tag.dados (base64). Trocar a chave invalida as conexões (é preciso reconectar).
function key(): Buffer {
  const raw = (process.env.TOKEN_ENCRYPTION_KEY ?? "").trim();
  const buf = raw ? Buffer.from(raw, "base64") : Buffer.alloc(0);
  if (buf.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY ausente ou inválida (use 32 bytes em base64).");
  return buf;
}

export const hasEncryptionKey = () => {
  try {
    key();
    return true;
  } catch {
    return false;
  }
};

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), enc.toString("base64")].join(".");
}

export function decrypt(payload: string): string {
  const [iv, tag, data] = payload.split(".");
  if (!iv || !tag || !data) throw new Error("Token cifrado em formato inválido.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}
