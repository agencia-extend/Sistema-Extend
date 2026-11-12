import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { getClient, listMonthTasks } from "@/features/clients/queries";
import { EmptyState } from "@/components/app/states";
import { buttonVariants } from "@/components/ui/button";
import { currentMonthKey, formatDate } from "@/domain/shared/dates";
import { TaskStatusSelect } from "./task-status";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function shift(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Demanda do mês: contratado × produzido × aprovado × publicado (RF-TAR-08). */
export default async function DemandaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mes?: string }> }) {
  const user = await requirePermission("clients.read");
  const { id } = await params;
  const client = (await getClient(id))!;
  if (client.status === "onboarding") redirect(`/clientes/${id}`);
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? sp.mes! : currentMonthKey();
  const tasks = await listMonthTasks(id, `${month}-01`);
  const [y, m] = month.split("-").map(Number);
  const groups = [...new Set(tasks.map((t) => t.service))];
  const nowIso = new Date().toISOString();

  return (
    <div className="grid max-w-5xl gap-5">
      <div className="flex items-center gap-2">
        <Link href={`?mes=${shift(month, -1)}`} className={buttonVariants({ variant: "outline", size: "icon" })} aria-label="Mês anterior"><ChevronLeft /></Link>
        <h2 className="min-w-40 text-center text-base font-semibold capitalize">{MONTHS[m - 1]} de {y}</h2>
        <Link href={`?mes=${shift(month, 1)}`} className={buttonVariants({ variant: "outline", size: "icon" })} aria-label="Próximo mês"><ChevronRight /></Link>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Sem demandas neste mês"
          description="As demandas são criadas no dia 1º para os serviços com quantidade mensal (vídeos, artes, posts). Ajuste as quantidades em Visão geral → Serviços."
        />
      ) : (
        groups.map((g) => {
          const list = tasks.filter((t) => t.service === g && t.status !== "cancelado");
          const produced = list.filter((t) => ["aguardando_aprovacao", "aprovado", "concluido"].includes(t.status)).length;
          const approved = list.filter((t) => ["aprovado", "concluido"].includes(t.status)).length;
          const published = list.filter((t) => t.status === "concluido").length;
          return (
            <section key={g} className="overflow-hidden rounded-xl border bg-card" aria-label={g}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/50 px-4 py-2.5">
                <h3 className="text-sm font-semibold">{g}</h3>
                <dl className="flex gap-4 text-xs tabular">
                  <div><dt className="inline text-muted-foreground">Contratado </dt><dd className="inline font-semibold">{list.length}</dd></div>
                  <div><dt className="inline text-muted-foreground">Produzido </dt><dd className="inline font-semibold">{produced}</dd></div>
                  <div><dt className="inline text-muted-foreground">Aprovado </dt><dd className="inline font-semibold">{approved}</dd></div>
                  <div><dt className="inline text-muted-foreground">Entregue </dt><dd className="inline font-semibold">{published}</dd></div>
                </dl>
              </div>
              <ul className="divide-y">
                {tasks.filter((t) => t.service === g).map((t) => {
                  const late = t.due_at && t.due_at < nowIso && !["aprovado", "concluido", "cancelado"].includes(t.status);
                  const mine = t.assignee_id === user.id;
                  return (
                    <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
                      <div className="grid min-w-0 flex-1 basis-56 gap-0.5">
                        <Link href={`/tarefas/${t.id}`} className="text-sm hover:underline">{t.title}</Link>
                        <span className={late ? "text-xs font-medium text-danger" : "text-xs text-muted-foreground"}>
                          {[t.assignee ?? "Sem responsável", t.due_at ? `${late ? "atrasada · " : ""}prazo ${formatDate(t.due_at)}` : null].filter(Boolean).join(" · ")}
                        </span>
                      </div>
                      {t.step ? (
                        <Link href={`/tarefas/${t.id}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm hover:border-brand/60">
                          <span className="size-2 rounded-full" style={{ background: t.step.color }} aria-hidden="true" />
                          {t.step.name}
                        </Link>
                      ) : (
                        <TaskStatusSelect id={t.id} status={t.status} disabled={!user.permissions["tasks.manage"] && !mine} />
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
