/**
 * Links com UTM (RF-ADS-11). Monta a URL final preservando os parâmetros dinâmicos das plataformas:
 * Meta usa {{campaign.name}}, Google usa ValueTrack ({campaignid}, {keyword}). Valores digitados à mão
 * viram minúsculas, sem acento e com "_" no lugar de espaço, para não quebrar os relatórios do Analytics.
 */
export const UTM_PLATFORMS = ["meta", "google", "outro"] as const;
export type UtmPlatform = (typeof UTM_PLATFORMS)[number];
export const UTM_PLATFORM_LABEL: Record<UtmPlatform, string> = { meta: "Meta Ads", google: "Google Ads", outro: "Outro (bio, e-mail, WhatsApp)" };

export type UtmParams = { source: string; medium: string; campaign: string; term: string; content: string };
export const UTM_FIELDS = ["source", "medium", "campaign", "term", "content"] as const;

/** Modelos por plataforma. A Meta e o Google trocam as chaves pelo valor real em cada clique. */
export const UTM_PRESETS: Record<UtmPlatform, UtmParams> = {
  meta: { source: "{{site_source_name}}", medium: "cpc", campaign: "{{campaign.name}}", term: "{{adset.name}}", content: "{{ad.name}}" },
  google: { source: "google", medium: "cpc", campaign: "{campaignid}", term: "{keyword}", content: "{creative}" },
  outro: { source: "", medium: "", campaign: "", term: "", content: "" },
};

const MACRO = /(\{\{[a-z_.]+\}\}|\{[a-z_]+\})/i;

/** Normaliza o que foi digitado e deixa os parâmetros dinâmicos como estão. */
export function utmValue(raw: string): string {
  return raw
    .trim()
    .split(MACRO)
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .toLowerCase()
            .replace(/\s+/g, "_")
            .replace(/[^a-z0-9_.+-]/g, ""),
    )
    .join("");
}

const encode = (v: string) => encodeURIComponent(v).replace(/%7B/g, "{").replace(/%7D/g, "}");

/** Só a parte dos parâmetros (para o campo "Parâmetros de URL" do anúncio na Meta). */
export function utmQuery(p: UtmParams): string {
  return UTM_FIELDS.map((k) => [k, utmValue(p[k])] as const)
    .filter(([, v]) => v)
    .map(([k, v]) => `utm_${k}=${encode(v)}`)
    .join("&");
}

/** Endereço de destino válido (http ou https), normalizado; null se não for. */
export function normalizeBaseUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (!u.hostname.includes(".")) return null;
  return u.toString();
}

/** URL final: o destino sem UTMs antigas + as novas, mantendo os outros parâmetros e a âncora. */
export function buildUtmUrl(base: string, p: UtmParams): string | null {
  const norm = normalizeBaseUrl(base);
  if (!norm) return null;
  const u = new URL(norm);
  for (const k of [...u.searchParams.keys()]) if (k.toLowerCase().startsWith("utm_")) u.searchParams.delete(k);
  const hash = u.hash;
  u.hash = "";
  const head = u.toString();
  const q = utmQuery(p);
  if (!q) return head + hash;
  return `${head}${u.search ? "&" : "?"}${q}${hash}`;
}

/** Modelo de acompanhamento do Google Ads: o Google troca {lpurl} pelo endereço final do anúncio. */
export const googleTrackingTemplate = (p: UtmParams) => `{lpurl}?${utmQuery(p)}`;
