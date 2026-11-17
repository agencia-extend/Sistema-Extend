import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/states";
import { buttonVariants } from "@/components/ui/button";
import { PERIOD_LABEL, parsePeriod, periodRange, type Period } from "@/domain/ads";
import { todayKey } from "@/domain/media";
import { formatBRL } from "@/domain/shared/money";
import { getTrafficPanel } from "@/features/ads/queries";
import { PanelTable } from "@/features/ads/components/panel-table";
import { SyncButton } from "@/features/ads/components/sync-button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Painel do tráfego" };
export const maxDuration = 60;

/** RF-ADS-05: contas ligadas de cada cliente → campanhas, com gasto, CTR, CPM, resultados e custo por resultado. */
export default async function PainelTrafegoPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const user = await requirePermission(["ads.read"]);
  const sp = await searchParams;
  const period = parsePeriod(sp.periodo);
  const today = todayKey(new Date());
  const accounts = await getTrafficPanel(periodRange(period, today), today);
  const spend = accounts.reduce((s, a) => s + a.totals.spend_cents, 0);
  const lowFunds = accounts.filter((a) => a.daysLeft !== null && a.daysLeft <= 3).length;
  const errors = accounts.filter((a) => a.syncError).length;

  return (
    <>
      <PageHeader
        title="Painel do tráfego"
        description="Números da Meta de cada conta ligada, atualizados a cada 3 horas. Mostra as campanhas no ar e as que gastaram no período."
        actions={user.permissions["ads.connect"] && accounts.length > 0 ? <SyncButton clientId={null} /> : undefined}
      />
      <PageBody className="grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-5">
        <nav aria-label="Período" className="flex flex-wrap gap-1 text-sm">
          {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
            <Link key={p} href={`/trafego/painel?periodo=${p}`} aria-current={p === period ? "page" : undefined}
              className={cn("rounded-md px-3 py-1.5", p === period ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
              {PERIOD_LABEL[p]}
            </Link>
          ))}
        </nav>
        {accounts.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="Nenhuma conta de anúncio ligada"
            description="As contas aparecem aqui depois de ligadas a um cliente e incluídas no sistema, em Configurações › Integrações (ou na aba Tráfego do cliente, pelo Facebook dele)."
            action={user.permissions["ads.connect"] ? <Link href="/configuracoes/integracoes" className={buttonVariants({ variant: "outline" })}>Abrir Integrações</Link> : undefined}
          />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {accounts.length} {accounts.length === 1 ? "conta" : "contas"} · gasto de {formatBRL(spend)} em {PERIOD_LABEL[period].toLowerCase()}
              {lowFunds ? <span className="font-medium text-danger"> · {lowFunds} com saldo para até 3 dias</span> : null}
              {errors ? <span className="font-medium text-danger"> · {errors} com erro na sincronização</span> : null}
            </p>
            <PanelTable accounts={accounts} />
          </>
        )}
      </PageBody>
    </>
  );
}
