import Link from "next/link";
import { Clapperboard, ExternalLink, Pencil, Plus } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { listTeam } from "@/features/clients/queries";
import { listRecordableContents, listRecordings } from "@/features/schedule/queries";
import { RecordingDialog } from "@/features/schedule/components/recording-dialog";
import { EmptyState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { todayKey } from "@/domain/media";
import { dayLabel } from "@/domain/trainings";
import { DeleteRecordingButton } from "./delete-recording";

/** Gravações do cliente, uma por diária: quem gravou, onde, link dos brutos e conteúdos gravados. */
export default async function GravacoesPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("tasks.read");
  const { id } = await params;
  const canEdit = Boolean(user.permissions["tasks.manage"]);
  const [sessions, team, open] = await Promise.all([listRecordings(id), canEdit ? listTeam() : Promise.resolve([]), canEdit ? listRecordableContents(id) : Promise.resolve([])]);
  const people = team.map((t) => ({ id: t.id, name: t.name }));
  const canManageClient = Boolean(user.permissions["clients.manage"] || user.permissions["clients.onboarding.manage"]);

  return (
    <div className="grid max-w-4xl gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-sm text-muted-foreground">Registro de cada diária de gravação. Os takes brutos ficam no Drive de brutos; aqui fica o link e quais conteúdos saíram daquela diária.</p>
        {canEdit && (
          <RecordingDialog
            clientId={id}
            title="Registrar gravação"
            team={people}
            contents={open}
            initial={{ recordedOn: todayKey(new Date()), location: "", rawUrl: "", notes: "", people: [user.id], tasks: [] }}
            trigger={<Button size="sm"><Plus aria-hidden="true" /> Registrar gravação</Button>}
          />
        )}
      </div>
      {sessions.length === 0 ? (
        <EmptyState icon={Clapperboard} title="Nenhuma gravação registrada" description="Depois de cada diária, registre quem gravou, onde, o link dos brutos e quais conteúdos foram gravados." />
      ) : (
        <ol aria-label="Gravações" className="grid gap-3">
          {sessions.map((s) => {
            const contents = [...s.contents, ...open.filter((o) => !s.contents.some((c) => c.id === o.id))];
            return (
              <li key={s.id} className="grid gap-2 rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold tabular">{dayLabel(s.recordedOn)}{s.location ? ` · ${s.location}` : ""}</span>
                  {canEdit && (
                    <div className="flex gap-1">
                      <RecordingDialog
                        clientId={id}
                        title="Editar gravação"
                        team={people}
                        contents={contents}
                        initial={{ id: s.id, recordedOn: s.recordedOn, location: s.location ?? "", rawUrl: s.rawUrl ?? "", notes: s.notes ?? "", people: s.people.map((p) => p.id), tasks: s.contents.map((c) => c.id) }}
                        trigger={<Button variant="ghost" size="icon" aria-label={`Editar a gravação de ${dayLabel(s.recordedOn)}`}><Pencil /></Button>}
                      />
                      {(canManageClient || s.createdBy === user.id) && <DeleteRecordingButton id={s.id} clientId={id} label={dayLabel(s.recordedOn)} />}
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">Gravado por {s.people.map((p) => p.name).join(", ") || "—"}</p>
                {s.rawUrl && (
                  <a href={s.rawUrl} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                    <ExternalLink className="size-4" aria-hidden="true" /> Takes brutos
                  </a>
                )}
                {s.contents.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5" aria-label="Conteúdos gravados">
                    {s.contents.map((c) => (
                      <li key={c.id}><Link href={`/tarefas/${c.id}`} className="inline-block rounded-md bg-muted px-2 py-0.5 text-xs hover:underline">{c.title}</Link></li>
                    ))}
                  </ul>
                )}
                {s.notes && <p className="text-sm break-words whitespace-pre-line text-muted-foreground">{s.notes}</p>}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
