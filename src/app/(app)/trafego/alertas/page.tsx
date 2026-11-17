import type { Metadata } from "next";
import Link from "next/link";
import { BellRing } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/states";
import { ALERT_TABS, parseAlertTab } from "@/domain/ads/alerts";
import { getAlerts } from "@/features/alerts/queries";
import { AlertList } from "@/features/alerts/components/alert-list";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Alertas" };

const EMPTY = {
  abertos: { title: "Nenhum alerta aberto", description: "Os alertas aparecem aqui quando a verificação automática encontra saldo acabando, conta com restrição, anúncio sem entrega ou reprovado, meta fora do ritmo ou conexão parada." },
  reconhecidos: { title: "Nenhum alerta reconhecido", description: "Reconheça um alerta aberto para avisar que está cuidando dele. Os avisos diários param até ele ser resolvido." },
  resolvidos: { title: "Nenhum alerta resolvido", description: "Aqui ficam os alertas resolvidos à mão, com a nota de como foi resolvido, e os que se resolveram sozinhos." },
};

/** RF-ALE-03: alertas abertos, reconhecidos e resolvidos, com quem resolveu e como. */
export default async function AlertasPage({ searchParams }: { searchParams: Promise<{ situacao?: string }> }) {
  const user = await requirePermission(["ads.read"]);
  const tab = parseAlertTab((await searchParams).situacao);
  const { rows, counts } = await getAlerts(tab, user);
  const empty = EMPTY[tab];

  return (
    <>
      <PageHeader
        title="Alertas"
        description="Problemas nas contas de anúncio dos clientes, verificados depois de cada sincronização. Reconheça o que estiver cuidando e resolva contando como. Quando o problema some, o alerta se resolve sozinho."
      />
      <PageBody className="grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-5">
        <nav aria-label="Situação" className="flex flex-wrap gap-1 text-sm">
          {ALERT_TABS.map((t) => {
            const n = t.key === "abertos" ? counts.abertos : t.key === "reconhecidos" ? counts.reconhecidos : null;
            return (
              <Link key={t.key} href={`/trafego/alertas?situacao=${t.key}`} aria-current={t.key === tab ? "page" : undefined}
                className={cn("rounded-md px-3 py-1.5", t.key === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                {t.label}{n !== null && <span className="ml-1.5 tabular">{n}</span>}
              </Link>
            );
          })}
        </nav>
        {rows.length === 0 ? <EmptyState icon={BellRing} title={empty.title} description={empty.description} /> : <AlertList rows={rows} />}
      </PageBody>
    </>
  );
}
