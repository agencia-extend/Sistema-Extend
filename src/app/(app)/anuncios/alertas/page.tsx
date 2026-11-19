import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { EmptyState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { ALERT_TABS, limitsSummary, parseAlertTab } from "@/domain/ads/alerts";
import { todayKey } from "@/domain/media";
import { formatBRL } from "@/domain/shared/money";
import { LimitsDialog } from "@/features/alerts/components/limits-dialog";
import { AlertList } from "@/features/alerts/components/alert-list";
import { getAlerts, getClientsAlertLimits } from "@/features/alerts/queries";
import { getModuleAccounts } from "@/features/ads/module-queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Alertas" };

const EMPTY = {
  abertos: { title: "Nenhum alerta aberto", description: "Os alertas aparecem aqui quando a verificação automática encontra saldo acabando, conta com restrição, anúncio sem entrega ou reprovado, gasto do dia acima do limite, criativo cansado, meta fora do ritmo ou conexão parada." },
  reconhecidos: { title: "Nenhum alerta reconhecido", description: "Reconheça um alerta aberto para avisar que está cuidando dele. Os avisos diários param até ele ser resolvido." },
  resolvidos: { title: "Nenhum alerta resolvido", description: "Aqui ficam os alertas resolvidos à mão, com a nota de como foi resolvido, e os que se resolveram sozinhos." },
};

/**
 * Alertas (RF-ALE-01/03), como no HubSystem: os alertas abertos, reconhecidos e resolvidos e, abaixo, o que dispara
 * aviso em cada cliente (padrão da agência ou limites próprios), com o saldo atual e a edição dos limites.
 */
export default async function AnunciosAlertasPage({ searchParams }: { searchParams: Promise<{ situacao?: string }> }) {
  const user = await requirePermission(["ads.read"]);
  const tab = parseAlertTab((await searchParams).situacao);
  const accounts = await getModuleAccounts(todayKey(new Date()));
  const clients = [...new Map(accounts.filter((a) => a.clientId).map((a) => [a.clientId!, a.clientName ?? "Cliente"])).entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  const [{ rows, counts }, limits] = await Promise.all([getAlerts(tab, user), getClientsAlertLimits(clients.map(([id]) => id))]);
  const empty = EMPTY[tab];
  const canEdit = Boolean(user.permissions["ads.manage"]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="Situação dos alertas" className="flex flex-wrap gap-1 text-sm">
          {ALERT_TABS.map((t) => {
            const n = t.key === "abertos" ? counts.abertos : t.key === "reconhecidos" ? counts.reconhecidos : null;
            return (
              <Link key={t.key} href={`/anuncios/alertas?situacao=${t.key}`} aria-current={t.key === tab ? "page" : undefined}
                className={cn("rounded-md px-3 py-1.5", t.key === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                {t.label}{n !== null && <span className="ml-1.5 tabular-nums">{n}</span>}
              </Link>
            );
          })}
        </nav>
        {user.permissions["ads.connect"] && (
          <LimitsDialog clientId={null} limits={limits.agency} custom={false}
            trigger={<Button variant="outline" size="sm"><SlidersHorizontal aria-hidden="true" /> Limites padrão</Button>} />
        )}
      </div>
      {rows.length === 0 ? <EmptyState icon={BellRing} title={empty.title} description={empty.description} /> : <AlertList rows={rows} canRequestCreative={Boolean(user.permissions["creatives.request.create"])} />}

      <section aria-labelledby="alertas-clientes" className="grid gap-3">
        <div className="grid gap-1">
          <h2 id="alertas-clientes" className="text-base font-semibold">Alertas por cliente</h2>
          <p className="text-sm text-muted-foreground">Verificados depois de cada sincronização (a cada 3 horas).</p>
          <p className="text-sm text-muted-foreground">Padrão da agência: {limitsSummary(limits.agency, formatBRL)}.</p>
        </div>
        {clients.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-surface px-4 py-6 text-sm text-muted-foreground">Nenhum cliente com conta de anúncio ligada.</p>
        ) : (
          <ul aria-label="Limites por cliente" className="divide-y rounded-xl border bg-surface">
            {clients.map(([id, name]) => {
              const l = limits.byClient.get(id)!;
              const accs = accounts.filter((a) => a.clientId === id);
              const low = accs.find((a) => a.daysLeft !== null && a.daysLeft <= l.effective.fundsDays);
              const open = counts.byClient[id] ?? 0;
              return (
                <li key={id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <Link href={`/clientes/${id}/anuncios`} className="font-medium break-words hover:underline">{name}</Link>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs", l.custom ? "bg-info-soft text-info" : "bg-muted text-muted-foreground")}>{l.custom ? "Limites próprios" : "Padrão da agência"}</span>
                      {open > 0 && <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">{open} {open === 1 ? "aberto" : "abertos"}</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">Avisa: {limitsSummary(l.effective, formatBRL)}</span>
                    <span className="text-xs">
                      {accs.map((a, i) => (
                        <span key={a.id} className={cn(a === low && "font-medium text-danger")}>
                          {i > 0 && " · "}
                          {a === low && <TriangleAlert className="mr-0.5 inline size-3" aria-label="Saldo acabando" />}
                          {a.name}: {a.isPrepay && a.fundsCents !== null ? `saldo ${formatBRL(a.fundsCents)}${a.daysLeft !== null ? ` (~${a.daysLeft} ${a.daysLeft === 1 ? "dia" : "dias"})` : ""}` : "pós-paga"}
                        </span>
                      ))}
                    </span>
                  </div>
                  {canEdit && (
                    <LimitsDialog clientId={id} clientName={name} limits={l.effective} custom={l.custom}
                      trigger={<Button size="sm" variant="outline" aria-label={`Editar os limites de ${name}`}><SlidersHorizontal aria-hidden="true" /> Limites</Button>} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
