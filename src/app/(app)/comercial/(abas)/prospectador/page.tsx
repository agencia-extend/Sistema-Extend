import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/app/states";
import { formatDateTime } from "@/domain/shared/dates";
import { listPipelines } from "@/features/crm/queries";
import { pickPipeline } from "@/features/crm/defaults";
import { ProspectorPanel } from "@/features/crm/components/prospector-panel";
import { monthlyLimit, placesConfigured } from "@/lib/crm/places";

export const metadata: Metadata = { title: "Prospectador" };

/** Prospectador (RF-CRM-07): empresas do Google Maps por nicho e cidade, com score, levadas ao funil sem repetir. */
export default async function ProspectadorPage({ searchParams }: { searchParams: Promise<{ funil?: string }> }) {
  const [user, sp] = await Promise.all([requirePermission("prospector.use"), searchParams]);
  if (!placesConfigured()) {
    return (
      <EmptyState
        title="Prospectador ainda não configurado"
        description="Falta a chave do Google Places no servidor (GOOGLE_PLACES_API_KEY), do projeto do Google Cloud da Extend com a Places API (New) ativada e limite de gasto. Passo a passo em docs/11."
      />
    );
  }
  const supabase = await createClient();
  const [pipelines, { data: usage }, { data: recent }] = await Promise.all([
    listPipelines(),
    supabase.rpc("prospector_month_usage"),
    supabase.from("prospect_searches").select("id, query, city, uf, result_count, created_at").order("created_at", { ascending: false }).limit(8),
  ]);
  const pipeline = pickPipeline(pipelines, sp.funil);
  if (!pipeline) return <EmptyState title="Nenhum funil configurado" description="Crie um funil em Configurações › Funis comerciais." />;

  return (
    <div className="grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-8">
      <ProspectorPanel
        pipelines={pipelines.map((p) => ({ id: p.id, name: p.name }))}
        defaultPipeline={pipeline.id}
        canImport={Boolean(user.permissions["crm.leads.manage"])}
        usage={Number(usage ?? 0)}
        limit={monthlyLimit()}
      />
      <section aria-labelledby="pr-hist" className="grid gap-2">
        <h2 id="pr-hist" className="text-base font-semibold">Buscas recentes</h2>
        {!recent?.length ? (
          <p className="text-sm text-muted-foreground">Nenhuma busca ainda.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card text-sm">
            {recent.map((s) => (
              <li key={s.id} className="flex flex-wrap justify-between gap-2 px-4 py-2.5">
                <span>{s.query} em {s.city}, {s.uf}</span>
                <span className="text-xs text-muted-foreground tabular">{formatDateTime(s.created_at)} · {s.result_count} empresa(s)</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
