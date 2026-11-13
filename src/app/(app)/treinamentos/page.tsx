import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, GraduationCap, Plus } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TRAINING_CATEGORIES, TRAINING_CATEGORY_LABEL, assignmentState, dayLabel, durationLabel } from "@/domain/trainings";
import { todayKey } from "@/domain/media";
import { listTrainings, type TrainingCard } from "@/features/trainings/queries";
import { TrainingDialog } from "@/features/trainings/components/training-dialog";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Treinamentos" };

function Bar({ pct, complete }: { pct: number; complete: boolean }) {
  return (
    <span className="block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
      <span className={cn("block h-full rounded-full", complete ? "bg-success" : "bg-brand")} style={{ width: `${pct}%` }} />
    </span>
  );
}

function meta(t: TrainingCard) {
  return [`${t.lessons} aula${t.lessons === 1 ? "" : "s"}`, t.minutes ? durationLabel(t.minutes) : null].filter(Boolean).join(" · ");
}

/** Treinamentos da agência: o que foi pedido para a pessoa e a biblioteca toda, por área. */
export default async function TreinamentosPage() {
  const user = await requirePermission(["trainings.read", "trainings.manage"]);
  const manages = Boolean(user.permissions["trainings.manage"]);
  const trainings = await listTrainings(user.id);
  const today = todayKey(new Date());
  const pending = trainings
    .filter((t) => t.isPublished && t.assignment && !t.progress.complete)
    .sort((a, b) => (a.assignment!.dueOn ?? "9").localeCompare(b.assignment!.dueOn ?? "9"));
  const areas = TRAINING_CATEGORIES.map((c) => ({ c, items: trainings.filter((t) => t.category === c) })).filter((g) => g.items.length > 0);

  return (
    <>
      <PageHeader
        title="Treinamentos"
        description="Como a Extend trabalha, passo a passo. Marque cada aula ao terminar: a coordenação acompanha quem já fez."
        actions={manages ? <TrainingDialog trigger={<Button><Plus aria-hidden="true" /> Novo treinamento</Button>} /> : undefined}
      />
      <PageBody className="grid max-w-4xl grid-cols-[minmax(0,1fr)] gap-8">
        {pending.length > 0 && (
          <section aria-labelledby="para-voce" className="grid gap-3">
            <h2 id="para-voce" className="text-base font-semibold">Pedidos para você</h2>
            <ul className="divide-y rounded-xl border bg-card">
              {pending.map((t) => {
                const state = assignmentState(t.assignment!.dueOn, false, today);
                return (
                  <li key={t.id}>
                    <Link href={`/treinamentos/${t.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-4 py-3 hover:bg-muted/50">
                      <span className="truncate text-sm font-medium">{t.title}</span>
                      <span className={cn("text-xs tabular", state === "atrasado" ? "font-medium text-danger" : "text-muted-foreground")}>
                        {t.assignment!.dueOn ? `${state === "atrasado" ? "Atrasado · era " : "Até "}${dayLabel(t.assignment!.dueOn)}` : "Sem prazo"}
                      </span>
                      <Bar pct={t.progress.pct} complete={false} />
                      <span className="text-xs tabular text-muted-foreground">{t.progress.done}/{t.progress.total}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {areas.length === 0 ? (
          <div className="grid justify-items-start gap-3 rounded-xl border border-dashed bg-surface px-5 py-8">
            <GraduationCap className="size-6 text-muted-foreground" aria-hidden="true" />
            <p className="max-w-prose text-sm text-muted-foreground">
              {manages
                ? "Nenhum treinamento ainda. Crie o primeiro com o processo que mais gera dúvida na equipe (ex.: como montar o cronograma do mês)."
                : "Nenhum treinamento publicado ainda. Quando a coordenação publicar, ele aparece aqui."}
            </p>
          </div>
        ) : (
          areas.map(({ c, items }) => (
            <section key={c} aria-labelledby={`area-${c}`} className="grid gap-3">
              <h2 id={`area-${c}`} className="text-base font-semibold">{TRAINING_CATEGORY_LABEL[c]}</h2>
              <ul className="divide-y rounded-xl border bg-card">
                {items.map((t) => (
                  <li key={t.id}>
                    <Link href={`/treinamentos/${t.id}`} className="grid gap-2 px-4 py-3.5 hover:bg-muted/50 sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-center sm:gap-6">
                      <span className="grid min-w-0 gap-0.5">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{t.title}</span>
                          {!t.isPublished && <Badge variant="secondary">Rascunho</Badge>}
                        </span>
                        {t.summary && <span className="line-clamp-2 text-sm text-muted-foreground">{t.summary}</span>}
                        <span className="text-xs text-muted-foreground">{meta(t)}</span>
                      </span>
                      <span className="grid gap-1">
                        {t.progress.complete ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success"><CheckCircle2 className="size-3.5" aria-hidden="true" /> Concluído</span>
                        ) : (
                          <span className="text-xs tabular text-muted-foreground">{t.progress.done ? `${t.progress.done} de ${t.progress.total} aulas` : t.lessons ? "Não começou" : "Sem aulas ainda"}</span>
                        )}
                        <Bar pct={t.progress.pct} complete={t.progress.complete} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </PageBody>
    </>
  );
}
