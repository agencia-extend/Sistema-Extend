import type { Metadata } from "next";
import { Pencil, Plus, Repeat } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { listCatalog } from "@/features/clients/queries";
import { listSectors } from "@/features/admin/queries";
import { listTemplates } from "@/features/tasks/queries";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PRIORITY_LABEL, TASK_TYPE_LABEL } from "@/domain/tasks";
import { TEMPLATE_CATEGORY_LABEL, WEEKDAY_LABEL, repeatLabel } from "@/domain/tasks/repeat";
import { RoutineDialog } from "@/features/routines/components/routine-dialog";
import { TemplateDialog } from "@/features/routines/components/template-dialog";
import { DeleteButton } from "@/features/routines/components/delete-button";
import type { TemplateInput } from "@/features/routines/schemas";

export const metadata: Metadata = { title: "Rotinas e modelos" };

/** Rotinas semanais por serviço (criadas sozinhas para cada cliente) e modelos de demanda. */
export default async function RotinasPage() {
  await requirePermission("tasks.boards.configure");
  const supabase = await createClient();
  const [routines, catalog, sectors, templates] = await Promise.all([
    supabase.from("service_routines").select("id, service_id, title, description, sector_id, weekday, due_hour, lead_days, is_active").order("weekday").order("due_hour"),
    listCatalog(),
    listSectors(),
    listTemplates(false),
  ]);
  if (routines.error) throw routines.error;
  const services = catalog.filter((s) => s.is_active).map((s) => ({ id: s.id, name: s.name }));
  const sectorOpts = sectors.filter((s) => s.is_active).map((s) => ({ id: s.id, name: s.name }));
  const nameOf = (list: { id: string; name: string }[], id: string) => list.find((x) => x.id === id)?.name ?? "—";
  const byService = services.map((s) => ({ ...s, routines: routines.data.filter((r) => r.service_id === s.id) })).filter((s) => s.routines.length > 0);
  const cats = [...new Set(templates.map((t) => t.category))];

  return (
    <>
      <PageHeader title="Rotinas e modelos" description="O que se repete toda semana em cada cliente e os atalhos para criar demandas comuns." />
      <PageBody className="grid max-w-4xl gap-10">
        <section aria-labelledby="rotinas" className="grid gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="grid gap-1">
              <h2 id="rotinas" className="text-base font-semibold">Rotinas por serviço</h2>
              <p className="max-w-prose text-sm text-muted-foreground">
                Todo cliente ativo com o serviço ganha a demanda da semana, para a pessoa marcada no setor, alguns dias antes do prazo. Quem recebe é avisado.
              </p>
            </div>
            <RoutineDialog services={services} sectors={sectorOpts} trigger={<Button variant="outline"><Plus aria-hidden="true" /> Nova rotina</Button>} />
          </div>
          {byService.length === 0 ? (
            <p className="rounded-xl border border-dashed bg-surface px-4 py-6 text-sm text-muted-foreground">Nenhuma rotina. Crie uma para cada prazo fixo da semana (ex.: legendas prontas toda segunda).</p>
          ) : (
            byService.map((s) => (
              <div key={s.id} className="overflow-hidden rounded-xl border bg-card">
                <h3 className="border-b bg-muted/50 px-4 py-2.5 text-sm font-semibold">{s.name}</h3>
                <ul className="divide-y">
                  {s.routines.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                      <div className="grid min-w-0 flex-1 basis-56 gap-0.5">
                        <span className="text-sm font-medium">{r.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {WEEKDAY_LABEL[r.weekday]} até {String(r.due_hour).padStart(2, "0")}h · {nameOf(sectorOpts, r.sector_id)} · aparece {r.lead_days} dia{r.lead_days === 1 ? "" : "s"} antes
                        </span>
                      </div>
                      {!r.is_active && <Badge variant="secondary">Desligada</Badge>}
                      <div className="flex gap-1">
                        <RoutineDialog
                          services={services}
                          sectors={sectorOpts}
                          routine={{ id: r.id, serviceId: r.service_id, title: r.title, description: r.description ?? "", sectorId: r.sector_id, weekday: r.weekday, dueHour: r.due_hour, leadDays: r.lead_days, isActive: r.is_active }}
                          trigger={<Button variant="ghost" size="icon" aria-label={`Editar rotina: ${r.title}`}><Pencil /></Button>}
                        />
                        <DeleteButton kind="rotina" id={r.id} name={r.title} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>

        <section aria-labelledby="modelos" className="grid gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="grid gap-1">
              <h2 id="modelos" className="text-base font-semibold">Modelos de demanda</h2>
              <p className="max-w-prose text-sm text-muted-foreground">Ao criar uma demanda, o modelo preenche título, tipo, descrição, prazo e repetição.</p>
            </div>
            <TemplateDialog trigger={<Button variant="outline"><Plus aria-hidden="true" /> Novo modelo</Button>} />
          </div>
          {templates.length === 0 ? (
            <p className="rounded-xl border border-dashed bg-surface px-4 py-6 text-sm text-muted-foreground">Nenhum modelo ainda.</p>
          ) : (
            cats.map((c) => (
              <div key={c} className="overflow-hidden rounded-xl border bg-card">
                <h3 className="border-b bg-muted/50 px-4 py-2.5 text-sm font-semibold">{TEMPLATE_CATEGORY_LABEL[c] ?? c}</h3>
                <ul className="divide-y">
                  {templates.filter((t) => t.category === c).map((t) => {
                    const input: TemplateInput = {
                      id: t.id,
                      name: t.name,
                      category: t.category as TemplateInput["category"],
                      type: t.type as TemplateInput["type"],
                      description: t.description,
                      dueDays: t.dueDays,
                      priority: t.priority as TemplateInput["priority"],
                      repeat: t.repeatUnit && t.repeatEvery ? { unit: t.repeatUnit as "semana", every: t.repeatEvery } : null,
                      isActive: t.isActive,
                    };
                    const rep = repeatLabel(t.repeatUnit, t.repeatEvery);
                    return (
                      <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                        <div className="grid min-w-0 flex-1 basis-56 gap-0.5">
                          <span className="text-sm font-medium">{t.name}</span>
                          <span className="inline-flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                            <span>{TASK_TYPE_LABEL[t.type] ?? t.type}</span>
                            <span>prazo +{t.dueDays} dia{t.dueDays === 1 ? "" : "s"}</span>
                            <span>{PRIORITY_LABEL[t.priority]}</span>
                            {rep && <span className="inline-flex items-center gap-1"><Repeat className="size-3" aria-hidden="true" /> {rep.toLowerCase()}</span>}
                          </span>
                        </div>
                        {!t.isActive && <Badge variant="secondary">Inativo</Badge>}
                        <div className="flex gap-1">
                          <TemplateDialog template={input} trigger={<Button variant="ghost" size="icon" aria-label={`Editar modelo: ${t.name}`}><Pencil /></Button>} />
                          <DeleteButton kind="modelo" id={t.id} name={t.name} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </section>
      </PageBody>
    </>
  );
}
