// Prospectador (RF-CRM-07): score de oportunidade de um local do Google para a Extend.
// Quanto mais a empresa precisa de marketing (sem site, poucas avaliações, nota baixa) e quanto mais fácil
// é falar com ela (tem telefone), maior o score. De 0 a 100, com a explicação de cada ponto.

export type PlaceResult = {
  id: string;
  name: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  rating: number | null;
  reviews: number | null;
  mapsUrl: string | null;
  category: string | null;
  open: boolean;
};

export type ScoreReason = { points: number; text: string };
export type Scored = PlaceResult & { score: number; reasons: ScoreReason[] };

export const SCORE_RULES = [
  "Sem site: +35",
  "Site só em rede social ou agregador: +20",
  "Até 20 avaliações no Google: +20 (até 50: +10)",
  "Nota abaixo de 4,2: +15 (sem nota: +10)",
  "Tem telefone: +20",
  "Fechada definitivamente: score 0",
] as const;

const SOCIAL = /(instagram\.com|facebook\.com|fb\.com|linktr\.ee|wa\.me|whatsapp\.com|ifood\.com|google\.com|sites\.google|wixsite\.com\/?$)/i;

export function scorePlace(p: PlaceResult): Scored {
  if (!p.open) return { ...p, score: 0, reasons: [{ points: 0, text: "Fechada definitivamente no Google" }] };
  const reasons: ScoreReason[] = [];
  if (!p.website) reasons.push({ points: 35, text: "Sem site" });
  else if (SOCIAL.test(p.website)) reasons.push({ points: 20, text: "Site é rede social ou agregador" });
  const r = p.reviews ?? 0;
  if (r <= 20) reasons.push({ points: 20, text: `${r} avaliação(ões) no Google` });
  else if (r <= 50) reasons.push({ points: 10, text: `${r} avaliações no Google` });
  if (p.rating === null) reasons.push({ points: 10, text: "Sem nota no Google" });
  else if (p.rating < 4.2) reasons.push({ points: 15, text: `Nota ${String(p.rating).replace(".", ",")} no Google` });
  if (p.phone) reasons.push({ points: 20, text: "Tem telefone" });
  const score = Math.min(100, reasons.reduce((s, x) => s + x.points, 0));
  return { ...p, score, reasons };
}

export const scoreTone = (score: number) => (score >= 60 ? "alta" : score >= 35 ? "media" : "baixa");

/** Texto da busca no Google: nicho em cidade, UF. */
export const placesQuery = (niche: string, city: string, uf: string) => `${niche.trim()} em ${city.trim()}, ${uf.trim().toUpperCase()}`;

/** Observação gravada no lead importado. */
export function prospectNotes(p: Scored, niche: string): string {
  const lines = [
    `Prospectador (${niche}) · score ${p.score}/100`,
    p.category ? `Categoria: ${p.category}` : null,
    p.address ? `Endereço: ${p.address}` : null,
    p.website ? `Site: ${p.website}` : "Sem site",
    p.rating !== null ? `Google: nota ${String(p.rating).replace(".", ",")} (${p.reviews ?? 0} avaliações)` : `Google: ${p.reviews ?? 0} avaliações`,
    p.mapsUrl ? `Maps: ${p.mapsUrl}` : null,
    `Por quê: ${p.reasons.map((r) => r.text).join("; ")}`,
  ];
  return lines.filter(Boolean).join("\n").slice(0, 4000);
}

type ApiPlace = {
  id?: string;
  displayName?: { text?: string };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  primaryTypeDisplayName?: { text?: string };
  businessStatus?: string;
};

/** Resposta do Places API (New) → formato do sistema. */
export function fromApiPlace(a: ApiPlace): PlaceResult | null {
  if (!a.id || !a.displayName?.text) return null;
  return {
    id: a.id,
    name: a.displayName.text.slice(0, 200),
    phone: a.internationalPhoneNumber ?? a.nationalPhoneNumber ?? null,
    website: a.websiteUri ?? null,
    address: a.formattedAddress ?? null,
    rating: typeof a.rating === "number" ? a.rating : null,
    reviews: typeof a.userRatingCount === "number" ? a.userRatingCount : null,
    mapsUrl: a.googleMapsUri ?? null,
    category: a.primaryTypeDisplayName?.text ?? null,
    open: a.businessStatus !== "CLOSED_PERMANENTLY",
  };
}
