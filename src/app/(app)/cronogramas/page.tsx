import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { clientCode } from "@/domain/clients";
import { todayKey } from "@/domain/media";
import { byMissing, monthLabel, monthParam, monthRange, monthStatus, shiftMonth } from "@/domain/schedule";
import { listScheduleOverview } from "@/features/schedule/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Cronogramas do mês" };

/** RF-CON-01: visão do setor de gerenciamento. Por cliente, posts contratados × programados × postados e o que falta. */
export default async function CronogramasPage({ searchParams }: { searchParams: Promise<{ mes?: string; ver?: string }> }) {
  await requirePermission(["content.publish", "dashboards.read"]);
  const sp = await searchParams;
  const month = monthParam(sp.mes, todayKey(new Date()));
  const { start, end } = monthRange(month);
  const all = await listScheduleOverview(start, end);
  const hasMine = all.some((r) => r.mine);
  const onlyMine = hasMine && sp.ver !== "todos";
  const rows = byMissing(onlyMine ? all.filter((r) => r.mine) : all);
  const complete = rows.filter((r) => monthStatus(r.contracted, r.scheduled).complete).length;
  const q = (m: string, ver: string | undefined) => `/cronogramas?mes=${m}${ver === "todos" ? "&ver=todos" : ""}`;

  return (
    <>
      <PageHeader title="Cronogramas do mês" description="Posts contratados de cada cliente com gerenciamento e quantos já têm data. O mês fica completo quando os posts programados cobrem o contratado." />
      <PageBody className="grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="icon"><Link href={q(shiftMonth(month, -1), sp.ver)} aria-label="Mês anterior"><ChevronLeft /></Link></Button>
            <h2 className="min-w-44 text-center text-base font-semibold first-letter:uppercase">{monthLabel(month)}</h2>
            <Button asChild variant="ghost" size="icon"><Link href={q(shiftMonth(month, 1), sp.ver)} aria-label="Próximo mês"><ChevronRight /></Link></Button>
          </div>
          {hasMine && (
            <nav aria-label="Clientes" className="inline-flex rounded-lg border p-0.5 text-sm">
              {([["meus", "Meus clientes"], ["todos", "Todos"]] as const).map(([k, label]) => {
                const active = (k === "todos") === !onlyMine;
                return (
                  <Link key={k} href={q(month, k)} aria-current={active ? "page" : undefined} className={cn("rounded-md px-3 py-1.5", active ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}>
                    {label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="Nenhum cliente com gerenciamento"
            description="Aparecem aqui os clientes ativos com o serviço Gerenciamento de redes no mês. Para incluir, cadastre o serviço com a quantidade de posts na central do cliente."
          />
        ) : (
          <section className="grid gap-3" aria-labelledby="lista">
            <h2 id="lista" className="sr-only">Clientes</h2>
            <p className="text-sm text-muted-foreground">
              {complete === rows.length ? "Todos os cronogramas do mês estão completos." : `${complete} de ${rows.length} ${rows.length === 1 ? "cliente" : "clientes"} com o mês completo.`}
            </p>
            <div className="overflow-hidden rounded-xl border bg-card">
              <table className="w-full text-sm">
                <caption className="sr-only">Cronograma de cada cliente em {monthLabel(month)}</caption>
                <thead className="hidden border-b bg-muted/40 text-left text-xs whitespace-nowrap text-muted-foreground md:table-header-group">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-medium">Cliente</th>
                    <th scope="col" className="px-4 py-2 font-medium">Social media</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Contratados</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Programados</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Postados</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Sem data</th>
                    <th scope="col" className="px-4 py-2 font-medium">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => {
                    const st = monthStatus(r.contracted, r.scheduled);
                    const num = (label: string, v: number) => (
                      <td className="md:px-4 md:py-3 md:text-right">
                        <span className="text-muted-foreground md:hidden">{label}: </span>
                        <span className="tabular">{v}</span>
                      </td>
                    );
                    return (
                      <tr key={r.clientId} className="grid grid-cols-2 gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-4 md:table-row md:p-0">
                        <th scope="row" className="col-span-full min-w-0 text-left font-normal md:px-4 md:py-3">
                          <Link href={`/clientes/${r.clientId}/cronograma?mes=${month}`} className="font-medium break-words hover:underline">
                            {r.clientCode ? <span className="tabular text-muted-foreground">{clientCode(r.clientCode)} · </span> : null}
                            {r.clientName}
                          </Link>
                        </th>
                        <td className="col-span-full min-w-0 text-muted-foreground md:px-4 md:py-3">
                          <span className="md:hidden">Social media: </span>
                          {r.social.length ? r.social.join(", ") : <span>Ninguém no gerenciamento</span>}
                        </td>
                        {num("Contratados", r.contracted)}
                        {num("Programados", r.scheduled)}
                        {num("Postados", r.posted)}
                        {num("Sem data", r.undated)}
                        <td className="col-span-full pt-1 md:px-4 md:py-3">
                          <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", st.complete ? "bg-success-soft text-success" : "bg-warning-soft text-warning")}>
                            {st.complete ? "Completo" : `${st.missing === 1 ? "Falta 1 post" : `Faltam ${st.missing} posts`}`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </PageBody>
    </>
  );
}
