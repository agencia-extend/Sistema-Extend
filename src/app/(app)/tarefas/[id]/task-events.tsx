import Link from "next/link";
import { formatDateTime } from "@/domain/shared/dates";
import { Section } from "@/features/clients/components/section";
import { EventDialog } from "@/features/tasks/components/event-dialog";

type Ev = { id: string; title: string; kind: string; starts_at: string; ends_at: string; location: string | null };

/** Gravações e eventos ligados a este card (RF-AGE-04). */
export function TaskEvents({
  taskId,
  clientId,
  events,
  team,
  canSchedule,
  defaultTitle,
}: {
  taskId: string;
  clientId: string | null;
  events: Ev[];
  team: { id: string; name: string }[];
  canSchedule: boolean;
  defaultTitle: string;
}) {
  return (
    <Section
      title="Agenda"
      action={canSchedule ? <EventDialog team={team} preset={{ kind: "gravacao", title: defaultTitle, clientId, taskId }} label="Agendar gravação" /> : undefined}
    >
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma gravação ou evento ligado a este card.</p>
      ) : (
        <ul className="grid gap-2">
          {events.map((e) => (
            <li key={e.id}>
              <Link href={`/agenda?data=${e.starts_at.slice(0, 10)}`} className="grid gap-0.5 rounded-xl border bg-card p-3 hover:border-brand/60">
                <span className="text-sm font-medium">{e.title}</span>
                <span className="text-xs text-muted-foreground">{formatDateTime(e.starts_at)}{e.location ? ` · ${e.location}` : ""}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
