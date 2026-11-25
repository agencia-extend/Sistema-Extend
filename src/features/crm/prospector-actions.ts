"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok } from "@/domain/shared/result";
import { placesQuery, prospectNotes, scorePlace, type Scored } from "@/domain/crm/prospector";
import { normalizePhone } from "@/domain/crm";
import { PlacesError, monthlyLimit, placesConfigured, searchPlaces } from "@/lib/crm/places";

const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"] as const;

const searchSchema = z.object({
  niche: z.string().trim().min(2, "Informe o nicho (ex.: imobiliária).").max(80, "Use no máximo 80 caracteres."),
  city: z.string().trim().min(2, "Informe a cidade.").max(80, "Use no máximo 80 caracteres."),
  uf: z.enum(UFS, { message: "Escolha o estado." }),
  pages: z.number().int().min(1).max(3),
});

export type ProspectRow = Scored & { imported: boolean; inCrm: boolean };

/** Busca no Google Places, confere o limite do mês, registra a busca e marca o que já está no Comercial. */
export const searchProspects = defineAction({ schema: searchSchema, permission: "prospector.use" }, async ({ niche, city, uf, pages }, { user }) => {
  if (!placesConfigured()) return fail("business_rule", "O prospectador ainda não tem a chave do Google Places configurada no servidor.");
  const supabase = await createClient();
  const { data: usage, error: ue } = await supabase.rpc("prospector_month_usage");
  if (ue) throw ue;
  const limit = monthlyLimit();
  const left = limit - Number(usage ?? 0);
  if (left <= 0) return fail("business_rule", `O limite de ${limit} buscas deste mês foi atingido. Volta no dia 1º.`);

  let found: { places: Awaited<ReturnType<typeof searchPlaces>>["places"]; pagesUsed: number };
  try {
    found = await searchPlaces(placesQuery(niche, city, uf), Math.min(pages, left));
  } catch (e) {
    if (e instanceof PlacesError) return fail("network", e.message);
    throw e;
  }
  const admin = createAdminClient();
  const { error: le } = await admin.from("prospect_searches").insert({
    organization_id: user.organizationId, query: niche, city, uf, pages: Math.max(1, found.pagesUsed), result_count: found.places.length, created_by: user.id,
  });
  if (le) throw le;

  const ids = found.places.map((p) => p.id);
  const phones = found.places.map((p) => normalizePhone(p.phone ?? "")).filter((x): x is string => Boolean(x));
  const [{ data: done }, { data: leads }] = await Promise.all([
    ids.length ? supabase.from("prospect_places").select("place_id").in("place_id", ids) : Promise.resolve({ data: [] as { place_id: string }[] }),
    phones.length ? supabase.from("leads").select("phone").in("phone", phones) : Promise.resolve({ data: [] as { phone: string | null }[] }),
  ]);
  const imported = new Set((done ?? []).map((d) => d.place_id));
  const inCrm = new Set((leads ?? []).map((l) => l.phone));
  const rows: ProspectRow[] = found.places
    .map((p) => scorePlace(p))
    .map((p) => ({ ...p, imported: imported.has(p.id), inCrm: Boolean(p.phone && inCrm.has(normalizePhone(p.phone))) }))
    .sort((a, b) => Number(a.imported || a.inCrm) - Number(b.imported || b.inCrm) || b.score - a.score);
  revalidatePath("/comercial/prospectador");
  return ok({ rows, usage: Number(usage ?? 0) + Math.max(1, found.pagesUsed), limit }, `${rows.length} empresa(s) encontrada(s).`);
});

const placeSchema = z.object({
  id: z.string().min(5).max(300),
  name: z.string().min(1).max(200),
  phone: z.string().max(40).nullable(),
  website: z.string().max(500).nullable(),
  address: z.string().max(400).nullable(),
  rating: z.number().min(0).max(5).nullable(),
  reviews: z.number().int().min(0).nullable(),
  mapsUrl: z.string().max(500).nullable(),
  category: z.string().max(120).nullable(),
  open: z.boolean(),
});

const importSchema = z.object({
  pipelineId: z.uuid("Escolha o funil."),
  niche: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80),
  places: z.array(placeSchema).min(1, "Selecione ao menos uma empresa.").max(200),
});

/** Leva as empresas escolhidas ao funil (origem Prospecção), sem repetir, e marca os locais como importados. */
export const importProspects = defineAction({ schema: importSchema, permission: ["prospector.use"] }, async ({ pipelineId, niche, city, places }, { user }) => {
  if (!user.permissions["crm.leads.manage"]) return fail("forbidden", "Para importar você precisa poder gerenciar leads no Comercial.");
  const supabase = await createClient();
  const scored = places.map((p) => scorePlace(p));
  const rows = scored.map((p) => ({ name: p.name, company: p.name, phone: p.phone ?? "", email: "", source: "prospeccao", notes: prospectNotes(p, niche) }));
  const { data, error } = await supabase.rpc("import_leads", { p_file: `Prospectador: ${niche} em ${city}`.slice(0, 200), p_pipeline: pipelineId, p_rows: rows });
  if (error) {
    if (error.code === "P0001" || error.code === "P0002") return fail("business_rule", error.message);
    throw error;
  }
  const r = data as { import_id: string; imported: number; duplicates: number };
  const { error: me } = await supabase.rpc("mark_prospect_places", { p_import: r.import_id, p_places: places.map((p) => ({ id: p.id, name: p.name })) });
  if (me) throw me;
  revalidatePath("/comercial", "layout");
  return ok(r, `${r.imported} lead(s) no funil${r.duplicates ? `; ${r.duplicates} já estavam no Comercial` : ""}.`);
});
