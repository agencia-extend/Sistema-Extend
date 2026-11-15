import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { todayKey } from "@/domain/media";
import { weekStart } from "@/domain/traffic";
import { getRoutine } from "@/features/traffic/queries";
import { CheckDialog } from "@/features/traffic/components/check-dialog";
import { CheckStatusLine } from "@/features/traffic/components/check-history";

export const metadata: Metadata = { title: "Rotina do tráfego" };

const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Painel de pendências do gestor (RF-OTI-04): checklist de hoje e da semana de cada cliente com tráfego. */
export default async function TrafficRoutinePage() {
  await requirePermission("optimization.manage");
  const rows = await getRoutine();
  const today = todayKey(new Date());
  const monday = weekStart(today);
  const dailyOpen = rows.filter((r) => !r.daily).length;
  const weeklyOpen = rows.filter((r) => !r.weekly).length;
  // Em aberto primeiro; depois os com problema; por fim o resto, por nome.
  const sorted = [...rows].sort((a, b) => Number(Boolean(a.daily)) - Number(Boolean(b.daily)) || (b.daily?.problems ?? 0) - (a.daily?.problems ?? 0) || a.clientName.localeCompare(b.clientName, "pt-BR"));

  return (
    <>
      <PageHeader
        title="Rotina do tráfego"
        description="Checklist do dia e da semana de cada cliente com anúncios. Os lembretes saem às 11h dos dias úteis; o semanal, no último dia útil da semana."
      />
      <PageBody className="grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-4">
        {rows.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="Nenhum cliente com tráfego para você"
            description="Aparecem aqui os clientes ativos com serviço de anúncios em que você está na equipe de tráfego. Peça para incluir você na equipe do cliente, na ficha dele."
          />
        ) : (
          <>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {dailyOpen ? `${dailyOpen} de ${rows.length} ${rows.length === 1 ? "cliente" : "clientes"} sem o checklist de hoje (${br(today)}).` : `Checklist de hoje (${br(today)}) feito em todos os clientes.`}{" "}
              {weeklyOpen ? `${weeklyOpen} sem o da semana de ${br(monday)}.` : `Semana de ${br(monday)} completa.`}
            </p>
            <div className="overflow-hidden rounded-xl border bg-card">
              <table className="w-full text-sm">
                <caption className="sr-only">Checklists por cliente</caption>
                <thead className="hidden border-b bg-muted/40 text-left text-xs text-muted-foreground md:table-header-group">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-medium">Cliente</th>
                    <th scope="col" className="px-4 py-2 font-medium">Hoje</th>
                    <th scope="col" className="px-4 py-2 font-medium">Semana</th>
                    <th scope="col" className="px-4 py-2 font-medium"><span className="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sorted.map((r) => (
                    <tr key={r.clientId} className="grid gap-2 px-4 py-3 md:table-row md:p-0">
                      <th scope="row" className="min-w-0 text-left font-normal md:px-4 md:py-3">
                        <Link href={`/clientes/${r.clientId}/trafego`} className="font-medium hover:underline">
                          {r.clientCode ? <span className="tabular text-muted-foreground">{r.clientCode} · </span> : null}
                          {r.clientName}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">{r.team.length ? r.team.join(", ") : "Sem equipe de tráfego"}</p>
                      </th>
                      <td className="md:px-4 md:py-3">
                        <span className="mr-1 text-xs text-muted-foreground md:hidden">Hoje:</span>
                        <CheckStatusLine row={r.daily} open={r.lastDailyOn ? `Em aberto · último em ${br(r.lastDailyOn)}` : "Em aberto"} />
                      </td>
                      <td className="md:px-4 md:py-3">
                        <span className="mr-1 text-xs text-muted-foreground md:hidden">Semana:</span>
                        <CheckStatusLine row={r.weekly} open="Em aberto" />
                        {r.weekly && r.weekly.decisions > 0 && <span className="ml-1 text-xs text-muted-foreground">· {r.weekly.decisions} {r.weekly.decisions === 1 ? "decisão" : "decisões"}</span>}
                      </td>
                      <td className="flex flex-wrap gap-2 md:table-cell md:px-4 md:py-3 md:text-right">
                        {r.daily ? (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/clientes/${r.clientId}/trafego`} aria-label={`Ver os checklists de ${r.clientName}`}>Ver no cliente</Link>
                          </Button>
                        ) : (
                          <CheckDialog clientId={r.clientId} clientName={r.clientName} kind="diario" periodOn={today}
                            trigger={<Button size="sm" aria-label={`Fazer o checklist de hoje: ${r.clientName}`}>Fazer o do dia</Button>} />
                        )}
                        {!r.weekly && (
                          <CheckDialog clientId={r.clientId} clientName={r.clientName} kind="semanal" periodOn={monday}
                            trigger={<Button size="sm" variant="outline" className="md:ml-2" aria-label={`Fazer o checklist da semana: ${r.clientName}`}>Fazer o da semana</Button>} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </PageBody>
    </>
  );
}
