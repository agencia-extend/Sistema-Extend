import type { Metadata } from "next";
import Link from "next/link";
import { FileBarChart } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { clientCode } from "@/domain/clients";
import { todayKey } from "@/domain/media";
import { weekStart } from "@/domain/traffic";
import { REPORT_AREA_LABEL } from "@/domain/reports";
import { getReportRoutine, listWaiting } from "@/features/reports/queries";
import { FeedbackBadge } from "@/features/reports/components/feedback-badge";
import { FeedbackDialog } from "@/features/reports/components/feedback-dialog";
import { ReportDialog } from "@/features/reports/components/report-dialog";

export const metadata: Metadata = { title: "Relatórios da semana" };

const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Relatórios da semana por cliente e área (tráfego, conteúdo) e os que esperam o retorno do cliente. */
export default async function WeeklyReportsPage() {
  await requirePermission(["reports.manage", "content.publish"]);
  const today = todayKey(new Date());
  const monday = weekStart(today);
  const [rows, waitingAll] = await Promise.all([getReportRoutine(), listWaiting(addDays(today, -30))]);
  // Só os das semanas anteriores (os desta semana já estão na tabela) e de clientes desta lista.
  const mine = new Set(rows.map((r) => `${r.clientId}:${r.area}`));
  const waiting = waitingAll.filter((r) => r.weekOn < monday && mine.has(`${r.clientId}:${r.area}`));
  const open = rows.filter((r) => !r.report).length;
  const sorted = [...rows].sort((a, b) => Number(Boolean(a.report)) - Number(Boolean(b.report)) || a.clientName.localeCompare(b.clientName, "pt-BR"));

  return (
    <>
      <PageHeader
        title="Relatórios da semana"
        description="Envio do relatório semanal a cada cliente e o retorno dele. A partir de quarta, quem está na equipe recebe aviso dos que faltam."
      />
      <PageBody className="grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-8">
        {rows.length === 0 ? (
          <EmptyState
            icon={FileBarChart}
            title="Nenhum cliente com relatório para você"
            description="Aparecem aqui os clientes ativos com anúncios (relatório de tráfego) ou gerenciamento (relatório de conteúdo) em que você está na equipe."
          />
        ) : (
          <section className="grid gap-3" aria-labelledby="semana">
            <h2 id="semana" className="text-base font-semibold">Semana de {br(monday)}</h2>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {open ? `${open} de ${rows.length} ${rows.length === 1 ? "relatório" : "relatórios"} sem envio registrado.` : "Todos os relatórios da semana foram enviados."}
            </p>
            <div className="overflow-hidden rounded-xl border bg-card">
              <table className="w-full text-sm">
                <caption className="sr-only">Relatórios da semana por cliente</caption>
                <thead className="hidden border-b bg-muted/40 text-left text-xs text-muted-foreground md:table-header-group">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-medium">Cliente</th>
                    <th scope="col" className="px-4 py-2 font-medium">Área</th>
                    <th scope="col" className="px-4 py-2 font-medium">Envio</th>
                    <th scope="col" className="px-4 py-2 font-medium">Retorno</th>
                    <th scope="col" className="px-4 py-2 font-medium"><span className="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sorted.map((r) => {
                    const area = REPORT_AREA_LABEL[r.area].toLowerCase();
                    return (
                      <tr key={`${r.clientId}:${r.area}`} className="grid gap-2 px-4 py-3 md:table-row md:p-0">
                        <th scope="row" className="min-w-0 text-left font-normal md:px-4 md:py-3">
                          <Link href={`/clientes/${r.clientId}/relatorios`} className="font-medium hover:underline">
                            {r.clientCode ? <span className="tabular text-muted-foreground">{clientCode(r.clientCode)} · </span> : null}
                            {r.clientName}
                          </Link>
                          <span className="ml-2 text-xs text-muted-foreground md:hidden">{REPORT_AREA_LABEL[r.area]}</span>
                        </th>
                        <td className="hidden md:table-cell md:px-4 md:py-3">{REPORT_AREA_LABEL[r.area]}</td>
                        <td className="md:px-4 md:py-3">
                          {r.report ? (
                            <span>Enviado em {br(r.report.sentOn)}{r.report.by ? ` · ${r.report.by}` : ""}</span>
                          ) : (
                            <span className="text-warning">Não enviado{r.lastSentOn ? ` · último em ${br(r.lastSentOn)}` : ""}</span>
                          )}
                        </td>
                        <td className="md:px-4 md:py-3">
                          {r.report ? <FeedbackBadge feedback={r.report.feedback} /> : <span className="text-muted-foreground"><span aria-hidden="true">—</span><span className="sr-only">Sem envio</span></span>}
                        </td>
                        <td className="flex flex-wrap gap-2 md:table-cell md:px-4 md:py-3 md:text-right">
                          {!r.report && r.canSend && (
                            <ReportDialog clientId={r.clientId} clientName={r.clientName} area={r.area} today={today}
                              trigger={<Button size="sm" aria-label={`Registrar envio do relatório de ${area}: ${r.clientName}`}>Registrar envio</Button>} />
                          )}
                          {r.report && !r.report.feedback && (
                            <FeedbackDialog id={r.report.id} clientId={r.clientId} clientName={r.clientName} area={r.area} weekOn={monday}
                              trigger={<Button size="sm" variant="outline" aria-label={`Registrar o retorno de ${r.clientName} ao relatório de ${area}`}>Registrar retorno</Button>} />
                          )}
                          {r.report?.feedback && (
                            <Button asChild size="sm" variant="ghost">
                              <Link href={`/clientes/${r.clientId}/relatorios`} aria-label={`Ver os relatórios de ${r.clientName}`}>Ver no cliente</Link>
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {waiting.length > 0 && (
          <section className="grid gap-3" aria-labelledby="aguardando">
            <h2 id="aguardando" className="text-base font-semibold">Aguardando retorno de semanas anteriores</h2>
            <ul className="divide-y rounded-xl border bg-card">
              {waiting.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <Link href={`/clientes/${r.clientId}/relatorios`} className="font-medium hover:underline">{r.clientName}</Link>
                    <p className="text-muted-foreground">
                      {REPORT_AREA_LABEL[r.area]}, semana de {br(r.weekOn)}, enviado em {br(r.sentOn)}
                    </p>
                  </div>
                  <FeedbackDialog id={r.id} clientId={r.clientId} clientName={r.clientName ?? ""} area={r.area} weekOn={r.weekOn}
                    trigger={<Button size="sm" variant="outline" aria-label={`Registrar o retorno de ${r.clientName} ao relatório de ${REPORT_AREA_LABEL[r.area].toLowerCase()} da semana de ${br(r.weekOn)}`}>Registrar retorno</Button>} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </PageBody>
    </>
  );
}
