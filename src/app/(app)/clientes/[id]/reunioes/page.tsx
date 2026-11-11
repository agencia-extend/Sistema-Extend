import { CalendarDays } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { getClient, listMeetings, listTeam } from "@/features/clients/queries";
import { EmptyState } from "@/components/app/states";
import { MEETING_KINDS } from "@/domain/clients";
import { formatDateTime } from "@/domain/shared/dates";
import { Pill } from "@/features/clients/components/bits";
import { MeetingDialog } from "./meeting-dialog";
import { FileLink, UploadButton } from "@/features/clients/components/files";

export default async function ReunioesPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("clients.read");
  const { id } = await params;
  const [client, meetings, team] = await Promise.all([getClient(id), listMeetings(id), listTeam()]);
  const names = new Map(team.map((t) => [t.id, t.name]));
  const canManage = Boolean(user.permissions["clients.manage"] || user.permissions["clients.onboarding.manage"]);
  const now = new Date().toISOString();

  return (
    <div className="grid max-w-4xl gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Briefing, planejamento, alinhamentos e resultados de {client!.name}, com ata e gravação.</p>
        <MeetingDialog clientId={id} team={team.map((t) => ({ id: t.id, name: t.name }))} />
      </div>
      {meetings.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Nenhuma reunião registrada" description="Registre a reunião de briefing ou agende a próxima. Os participantes são avisados." />
      ) : (
        <ol className="grid gap-3">
          {meetings.map((m) => (
            <li key={m.id} className="grid gap-2 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <time className="text-sm font-medium tabular" dateTime={m.held_at}>{formatDateTime(m.held_at)}</time>
                <Pill tone="info">{MEETING_KINDS[m.kind] ?? m.kind}</Pill>
                {m.held_at > now && <Pill tone="warning">Agendada</Pill>}
                {(canManage || m.created_by === user.id) && (
                  <span className="ml-auto">
                    <MeetingDialog
                      clientId={id}
                      team={team.map((t) => ({ id: t.id, name: t.name }))}
                      meeting={{ id: m.id, held_at: m.held_at, kind: m.kind, title: m.title, summary: m.summary ?? "", link: m.link ?? "", participant_ids: m.participant_ids }}
                    />
                  </span>
                )}
              </div>
              <h2 className="text-base font-semibold">{m.title}</h2>
              {m.participant_ids.length > 0 && (
                <p className="text-xs text-muted-foreground">Participantes: {m.participant_ids.map((p) => names.get(p) ?? "Ex-colaborador").join(", ")}</p>
              )}
              {m.summary && <p className="text-sm whitespace-pre-line">{m.summary}</p>}
              <div className="flex flex-wrap items-center gap-2">
                {m.link && (
                  <a href={m.link} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline">
                    Abrir gravação ou ata
                  </a>
                )}
                {m.client_files.map((f) => <FileLink key={f.id} path={f.storage_path} name={f.name} />)}
                <UploadButton clientId={id} category="reuniao" meetingId={m.id} label="Anexar ata" />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
