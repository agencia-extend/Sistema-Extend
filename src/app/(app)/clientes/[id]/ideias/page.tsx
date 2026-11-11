import { Lightbulb } from "lucide-react";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/dal";
import { getClient } from "@/features/clients/queries";
import { listIdeas } from "@/features/clients/queries";
import { EmptyState } from "@/components/app/states";
import { formatRelative } from "@/domain/shared/dates";
import { Pill } from "@/features/clients/components/bits";
import { IdeaDialog, IdeaActions } from "./idea-dialog";

export default async function IdeiasPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("clients.read");
  const { id } = await params;
  if ((await getClient(id))?.status === "onboarding") redirect(`/clientes/${id}`);
  const ideas = await listIdeas(id);
  const canManage = Boolean(user.permissions["clients.manage"] || user.permissions["clients.onboarding.manage"]);

  return (
    <div className="grid max-w-4xl gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Ideias de pauta, referências e links. Uma ideia pode virar demanda.</p>
        <IdeaDialog clientId={id} />
      </div>
      {ideas.length === 0 ? (
        <EmptyState icon={Lightbulb} title="Nenhuma ideia ainda" description="Guarde aqui referências e pautas que surgirem nas reuniões." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {ideas.map((i) => (
            <li key={i.id} className="grid content-start gap-2 rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-sm font-semibold">{i.title}</h2>
                {i.converted_task_id && <Pill tone="success">Virou demanda</Pill>}
              </div>
              {i.body && <p className="line-clamp-4 text-sm whitespace-pre-line text-muted-foreground">{i.body}</p>}
              {i.link && (
                <a href={i.link} target="_blank" rel="noreferrer" className="truncate text-sm text-primary hover:underline">{i.link}</a>
              )}
              {i.tags.length > 0 && (
                <ul className="flex flex-wrap gap-1">{i.tags.map((t) => <li key={t}><Pill tone="neutral">{t}</Pill></li>)}</ul>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{[i.author, formatRelative(i.created_at)].filter(Boolean).join(" · ")}</span>
                <IdeaActions
                  clientId={id}
                  idea={{ id: i.id, title: i.title, body: i.body ?? "", link: i.link ?? "", tags: i.tags }}
                  canEdit={canManage || i.created_by === user.id}
                  canConvert={Boolean(user.permissions["tasks.manage"]) && !i.converted_task_id}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
