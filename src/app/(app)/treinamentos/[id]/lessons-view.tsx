import Link from "next/link";
import { CheckCircle2, Circle, Clock, ExternalLink, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { durationLabel, videoEmbed } from "@/domain/trainings";
import type { getTraining } from "@/features/trainings/queries";
import { LessonBody } from "@/features/trainings/components/lesson-body";
import { LessonDialog } from "@/features/trainings/components/lesson-dialog";
import { DoneButton, FileButton, LessonAdmin, LessonFileAdmin } from "@/features/trainings/components/lesson-controls";
import { cn } from "@/lib/utils";

type Training = NonNullable<Awaited<ReturnType<typeof getTraining>>>;

/** Lista de aulas (à esquerda no computador, em cima no celular) e a aula aberta. */
export function LessonsView({ training: t, current, manages }: { training: Training; current?: string; manages: boolean }) {
  const href = (lessonId: string) => `/treinamentos/${t.id}?aula=${lessonId}`;
  const addButton = manages && (
    <LessonDialog trainingId={t.id} trigger={<Button variant="outline" className="w-full"><Plus aria-hidden="true" /> Nova aula</Button>} />
  );

  if (t.lessons.length === 0) {
    return (
      <div className="grid max-w-md justify-items-start gap-3 rounded-xl border border-dashed bg-surface px-5 py-8">
        <p className="text-sm text-muted-foreground">
          {manages ? "Este treinamento ainda não tem aulas. Comece pela primeira: um passo do processo por aula funciona melhor." : "Este treinamento ainda não tem aulas."}
        </p>
        {manages && <div className="w-48">{addButton}</div>}
      </div>
    );
  }

  const idx = Math.max(0, t.lessons.findIndex((l) => l.id === current));
  // Sem aula escolhida: abre a primeira que falta.
  const i = current ? idx : Math.max(0, t.lessons.findIndex((l) => !t.done.has(l.id)));
  const lesson = t.lessons[i];
  const next = t.lessons[i + 1] ?? null;
  const video = videoEmbed(lesson.videoUrl);
  const done = t.done.has(lesson.id);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-10">
      <div className="order-2 grid content-start gap-3 lg:order-1">
        <h2 className="text-sm font-semibold lg:sr-only">Todas as aulas</h2>
        <ol aria-label="Aulas" className="divide-y overflow-hidden rounded-xl border bg-card">
          {t.lessons.map((l, n) => {
            const isDone = t.done.has(l.id);
            const active = l.id === lesson.id;
            return (
              <li key={l.id}>
                <Link
                  href={href(l.id)}
                  scroll={false}
                  aria-current={active ? "step" : undefined}
                  className={cn("grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2.5 px-3.5 py-2.5 text-sm hover:bg-muted/50", active && "bg-accent text-accent-foreground")}
                >
                  {isDone ? <CheckCircle2 className="mt-0.5 size-4 text-success" aria-hidden="true" /> : <Circle className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />}
                  <span className={cn("min-w-0", active && "font-medium")}>
                    <span className="tabular text-muted-foreground">{n + 1}.</span> {l.title}
                    <span className="sr-only">{isDone ? " (concluída)" : " (não concluída)"}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
        {addButton}
      </div>

      <article aria-labelledby="aula-titulo" className="order-1 grid min-w-0 content-start gap-5 lg:order-2">
        <header className="grid gap-2">
          <p className="text-sm text-muted-foreground tabular">Aula {i + 1} de {t.lessons.length}</p>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 id="aula-titulo" className="text-lg font-semibold text-balance sm:text-xl">{lesson.title}</h2>
            {manages && (
              <div className="flex gap-1">
                <LessonDialog
                  trainingId={t.id}
                  lesson={{ id: lesson.id, trainingId: t.id, title: lesson.title, body: lesson.body ?? "", videoUrl: lesson.videoUrl ?? "", durationMin: lesson.durationMin }}
                  trigger={<Button variant="ghost" size="icon" aria-label={`Editar a aula ${lesson.title}`}><Pencil /></Button>}
                />
                <LessonAdmin lessonId={lesson.id} trainingId={t.id} title={lesson.title} first={i === 0} last={i === t.lessons.length - 1} />
              </div>
            )}
          </div>
          {lesson.durationMin && (
            <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><Clock className="size-3.5" aria-hidden="true" /> {durationLabel(lesson.durationMin)}</p>
          )}
        </header>

        {video ? (
          <div className="aspect-video overflow-hidden rounded-xl border bg-black">
            <iframe
              src={video.src}
              title={`Vídeo da aula: ${lesson.title}`}
              className="size-full"
              loading="lazy"
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        ) : (
          lesson.videoUrl && (
            <a href={lesson.videoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-brand underline underline-offset-2 hover:no-underline">
              <ExternalLink className="size-4" aria-hidden="true" /> Abrir o vídeo da aula
            </a>
          )
        )}

        {lesson.body ? <LessonBody text={lesson.body} /> : !video && !lesson.filePath && <p className="text-sm text-muted-foreground">Aula sem conteúdo ainda.</p>}

        {(lesson.filePath || manages) && (
          <div className="grid gap-2">
            {lesson.filePath && lesson.fileName && <div className="max-w-sm"><FileButton path={lesson.filePath} name={lesson.fileName} /></div>}
            {manages && <LessonFileAdmin lessonId={lesson.id} trainingId={t.id} hasFile={Boolean(lesson.filePath)} />}
          </div>
        )}

        <footer className="flex flex-wrap items-center gap-3 border-t pt-5">
          <DoneButton lessonId={lesson.id} trainingId={t.id} done={done} nextHref={next ? href(next.id) : null} />
          {next && done && (
            <Button asChild variant="ghost"><Link href={href(next.id)} scroll={false}>Próxima aula: {next.title}</Link></Button>
          )}
          {!next && done && t.progress.complete && <p className="text-sm font-medium text-success">Treinamento concluído. Bom trabalho!</p>}
        </footer>
      </article>
    </div>
  );
}
