import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TRAINING_CATEGORY_LABEL, dayLabel } from "@/domain/trainings";
import { getTraining, listTeamOptions } from "@/features/trainings/queries";
import { TrainingDialog } from "@/features/trainings/components/training-dialog";
import { DeleteTrainingButton } from "@/features/trainings/components/lesson-controls";
import { cn } from "@/lib/utils";
import { LessonsView } from "./lessons-view";
import { TeamView } from "./team-view";

export const metadata: Metadata = { title: "Treinamento" };

export default async function TreinamentoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aula?: string; aba?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const user = await requirePermission(["trainings.read", "trainings.manage"]);
  const manages = Boolean(user.permissions["trainings.manage"]);
  const t = await getTraining(id, user.id, manages);
  if (!t) notFound();
  const tab = manages && sp.aba === "equipe" ? "equipe" : "aulas";
  const people = tab === "equipe" ? await listTeamOptions() : [];

  const status = t.progress.complete
    ? "Você concluiu este treinamento."
    : t.lessons.length
      ? `${t.progress.done} de ${t.lessons.length} aulas concluídas${t.myDueOn ? ` · concluir até ${dayLabel(t.myDueOn)}` : ""}.`
      : "Ainda não tem aulas.";

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Treinamentos", href: "/treinamentos" }, { label: TRAINING_CATEGORY_LABEL[t.category] }]}
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            {t.title}
            {!t.isPublished && <Badge variant="secondary">Rascunho</Badge>}
          </span>
        }
        description={
          <>
            {t.summary && <span className="block">{t.summary}</span>}
            <span className={cn("mt-1 block", t.progress.complete && "font-medium text-success")}>{status}</span>
          </>
        }
        actions={
          manages ? (
            <>
              <TrainingDialog
                training={{ id: t.id, title: t.title, summary: t.summary ?? "", category: t.category, isPublished: t.isPublished }}
                trigger={<Button variant="outline"><Pencil aria-hidden="true" /> Editar</Button>}
              />
              <DeleteTrainingButton id={t.id} title={t.title} />
            </>
          ) : undefined
        }
      />
      {manages && (
        <nav aria-label="Seções do treinamento" className="mb-5 border-b px-2 sm:px-4">
          <ul className="flex gap-1 overflow-x-auto">
            {[
              ["aulas", "Aulas", `/treinamentos/${t.id}`],
              ["equipe", `Equipe (${t.team.length})`, `/treinamentos/${t.id}?aba=equipe`],
            ].map(([k, label, href]) => (
              <li key={k} className="shrink-0">
                <Link
                  href={href}
                  aria-current={tab === k ? "page" : undefined}
                  className={cn("-mb-px flex min-h-11 items-center border-b-2 px-3 text-sm whitespace-nowrap", tab === k ? "border-brand font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <PageBody className="grid grid-cols-[minmax(0,1fr)]">
        {tab === "equipe" ? (
          <TeamView trainingId={t.id} published={t.isPublished} team={t.team} people={people} />
        ) : (
          <LessonsView training={t} current={sp.aula} manages={manages} />
        )}
      </PageBody>
    </>
  );
}
