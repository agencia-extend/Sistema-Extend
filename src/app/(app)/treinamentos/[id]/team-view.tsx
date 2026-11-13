import { ASSIGNMENT_STATE_LABEL, assignmentState, dayLabel } from "@/domain/trainings";
import { todayKey } from "@/domain/media";
import type { TeamRow } from "@/features/trainings/queries";
import { AssignDialog } from "@/features/trainings/components/assign-dialog";
import { UnassignButton } from "@/features/trainings/components/lesson-controls";
import { cn } from "@/lib/utils";

const TONE = { concluido: "text-success", atrasado: "text-danger font-medium", no_prazo: "text-muted-foreground", sem_prazo: "text-muted-foreground" } as const;

/** Quem deve fazer o treinamento e em que pé está (só para quem gerencia). */
export function TeamView({ trainingId, published, team, people }: { trainingId: string; published: boolean; team: TeamRow[]; people: { id: string; name: string; jobTitle: string | null }[] }) {
  const today = todayKey(new Date());
  const done = team.filter((r) => r.progress.complete).length;

  return (
    <section aria-labelledby="equipe-titulo" className="grid max-w-4xl gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h2 id="equipe-titulo" className="text-base font-semibold">Quem deve fazer</h2>
          <p className="text-sm text-muted-foreground">
            {team.length ? `${done} de ${team.length} concluíram.` : "Ninguém na lista ainda. Atribua para a pessoa receber o aviso e você acompanhar aqui."}
          </p>
        </div>
        <AssignDialog trainingId={trainingId} people={people} assigned={team.map((r) => r.profileId)} published={published} />
      </div>

      {team.length > 0 && (
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground max-sm:sr-only">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Pessoa</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Aulas</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Prazo</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Situação</th>
                <th scope="col" className="w-12 px-2 py-2.5"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {team.map((r) => {
                const state = assignmentState(r.dueOn, r.progress.complete, today);
                return (
                  <tr key={r.assignmentId} className="max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:px-4 max-sm:py-3">
                    <td className="px-4 py-3 font-medium max-sm:p-0">{r.name}</td>
                    <td className="px-4 py-3 tabular max-sm:col-start-1 max-sm:p-0 max-sm:text-xs max-sm:text-muted-foreground">
                      <span className="sm:hidden">Aulas: </span>{r.progress.done}/{r.progress.total}
                    </td>
                    <td className="px-4 py-3 tabular max-sm:col-start-1 max-sm:p-0 max-sm:text-xs max-sm:text-muted-foreground">
                      <span className="sm:hidden">Prazo: </span>{r.dueOn ? dayLabel(r.dueOn) : "—"}
                    </td>
                    <td className={cn("px-4 py-3 max-sm:col-start-1 max-sm:p-0 max-sm:text-xs", TONE[state])}>{ASSIGNMENT_STATE_LABEL[state]}</td>
                    <td className="px-2 py-2 max-sm:col-start-2 max-sm:row-span-4 max-sm:row-start-1 max-sm:self-center max-sm:p-0">
                      <UnassignButton id={r.assignmentId} trainingId={trainingId} name={r.name} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
