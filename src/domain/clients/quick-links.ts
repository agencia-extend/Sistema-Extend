/**
 * Links rápidos no topo da central do cliente (docs/09, 3.2): Instagram, Drive, site, página, TikTok e
 * WhatsApp, montados a partir de "Contas e acessos". Só entra o que vira um endereço válido.
 */
export type QuickLink = { kind: string; label: string; href: string };

const ORDER = ["instagram", "drive_folder", "site", "page", "tiktok", "whatsapp"] as const;
const LABEL: Record<(typeof ORDER)[number], string> = {
  instagram: "Instagram",
  drive_folder: "Drive",
  site: "Site",
  page: "Facebook",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
};

function httpUrl(value: string): string | null {
  const v = value.trim();
  const withScheme = /^https?:\/\//i.test(v) ? v : /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(v) ? `https://${v}` : null;
  if (!withScheme) return null;
  try {
    const u = new URL(withScheme);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function handleUrl(value: string, base: string): string | null {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return httpUrl(v);
  const handle = v.replace(/^@/, "");
  return /^[\w.]{1,30}$/.test(handle) ? `${base}${handle}` : null;
}

function whatsappUrl(value: string): string | null {
  if (/^https?:\/\//i.test(value.trim())) return httpUrl(value);
  let digits = value.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits.length >= 12 && digits.length <= 13 ? `https://wa.me/${digits}` : null;
}

export function toQuickLink(kind: string, value: string): string | null {
  switch (kind) {
    case "instagram":
      return handleUrl(value, "https://instagram.com/");
    case "tiktok":
      return handleUrl(value, "https://www.tiktok.com/@");
    case "whatsapp":
      return whatsappUrl(value);
    case "drive_folder":
    case "site":
    case "page":
      return httpUrl(value);
    default:
      return null;
  }
}

export function quickLinks(accounts: { kind: string; value: string; label: string | null }[]): QuickLink[] {
  const out: QuickLink[] = [];
  for (const kind of ORDER) {
    const list = accounts.filter((a) => a.kind === kind);
    for (const a of list) {
      const href = toQuickLink(kind, a.value);
      if (!href) continue;
      out.push({ kind, href, label: list.length > 1 && a.label ? `${LABEL[kind]} (${a.label})` : LABEL[kind] });
    }
  }
  return out;
}
