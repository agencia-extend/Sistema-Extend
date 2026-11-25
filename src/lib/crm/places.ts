import "server-only";
import { fromApiPlace, type PlaceResult } from "@/domain/crm/prospector";
import { env } from "@/lib/integrations/config";

// Google Places API (New), Text Search, com a chave do projeto do Google Cloud da Extend (GOOGLE_PLACES_API_KEY).
// Cada página (até 20 locais) é uma requisição cobrada pelo Google; o limite do mês fica em PROSPECTOR_MONTHLY_LIMIT.

const FIELDS = [
  "places.id",
  "places.displayName",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.formattedAddress",
  "places.rating",
  "places.userRatingCount",
  "places.googleMapsUri",
  "places.primaryTypeDisplayName",
  "places.businessStatus",
  "nextPageToken",
].join(",");

export const placesConfigured = () => Boolean(env("GOOGLE_PLACES_API_KEY"));
export const monthlyLimit = () => {
  const n = Number(env("PROSPECTOR_MONTHLY_LIMIT") || 300);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 300;
};

export class PlacesError extends Error {}

const message = (status: number, reason?: string) => {
  if (status === 403 || reason === "PERMISSION_DENIED") return "A chave do Google Places foi recusada (API não ativada no projeto ou chave restrita). Confira em Google Cloud › APIs.";
  if (status === 429 || reason === "RESOURCE_EXHAUSTED") return "O Google limitou as buscas agora (cota do projeto). Tente mais tarde.";
  if (status === 400) return "O Google não aceitou a busca. Revise o nicho e a cidade.";
  return "O Google Places não respondeu. Tente de novo em instantes.";
};

/** Busca até `pages` páginas (20 locais cada). Devolve os locais e quantas páginas foram de fato pedidas. */
export async function searchPlaces(textQuery: string, pages: number): Promise<{ places: PlaceResult[]; pagesUsed: number }> {
  const key = env("GOOGLE_PLACES_API_KEY");
  if (!key) throw new PlacesError("O prospectador ainda não tem a chave do Google Places configurada.");
  const out = new Map<string, PlaceResult>();
  let pageToken: string | undefined;
  let used = 0;
  for (let i = 0; i < pages; i++) {
    if (i > 0 && !pageToken) break;
    let res: Response;
    try {
      res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELDS },
        body: JSON.stringify({ textQuery, languageCode: "pt-BR", regionCode: "BR", pageSize: 20, ...(pageToken ? { pageToken } : {}) }),
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new PlacesError("Sem resposta do Google Places (rede). Tente de novo em instantes.");
    }
    used++;
    const data = (await res.json().catch(() => ({}))) as { places?: unknown[]; nextPageToken?: string; error?: { status?: string } };
    if (!res.ok) throw new PlacesError(message(res.status, data.error?.status));
    for (const a of data.places ?? []) {
      const p = fromApiPlace(a as Parameters<typeof fromApiPlace>[0]);
      if (p && !out.has(p.id)) out.set(p.id, p);
    }
    pageToken = data.nextPageToken;
  }
  return { places: [...out.values()], pagesUsed: used };
}
