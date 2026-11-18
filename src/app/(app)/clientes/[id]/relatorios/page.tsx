import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/dal";
import { Section } from "@/features/clients/components/section";
import { currentServices, getClient } from "@/features/clients/queries";
import { todayKey } from "@/domain/media";
import { weekStart } from "@/domain/traffic";
import { REPORT_AREA_LABEL, reportAreas } from "@/domain/reports";
import { listReports } from "@/features/reports/queries";
import { AreaReports } from "@/features/reports/components/client-reports";
import { listReportFiles } from "@/features/ads/report-queries";
import { ReportFiles } from "@/features/ads/components/report-files";

export const metadata: Metadata = { title: "Relatórios do cliente" };

/** Relatório semanal enviado ao cliente (tráfego e conteúdo) e o retorno dele (briefing de mídias 3.9). */
export default async function ClientReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("clients.read");
  const { id } = await params;
  const seesAds = Boolean(user.permissions["ads.read"] || user.permissions["reports.manage"]);
  const [client, rows, files] = await Promise.all([getClient(id), listReports(id), seesAds ? listReportFiles(id) : Promise.resolve([])]);
  if (!client) notFound();
  const tabs = currentServices(client).flatMap((s) => (Array.isArray(s.service_catalog) ? s.service_catalog : s.service_catalog ? [s.service_catalog] : []).flatMap((c) => c.tabs));
  const areas = reportAreas(tabs);
  if (!areas.length) notFound();
  const today = todayKey(new Date());
  const monday = weekStart(today);
  const isOwner = client.owner_id === user.id;
  const canSend = { trafego: Boolean(user.permissions["reports.manage"]), conteudo: Boolean(user.permissions["content.publish"]) };

  return (
    <div className="grid max-w-5xl gap-10">
      <p className="max-w-prose text-sm text-muted-foreground">
        Registre o envio do relatório da semana e o retorno do cliente. Negativo avisa a equipe da área; sem retorno vira uma demanda de ligação para o responsável pela comunicação.
      </p>
      {areas.map((area) => (
        <Section key={area} title={`Relatório de ${REPORT_AREA_LABEL[area].toLowerCase()}`}>
          <AreaReports
            area={area}
            clientId={id}
            clientName={client.name}
            today={today}
            monday={monday}
            rows={rows.filter((r) => r.area === area)}
            canSend={canSend[area]}
            canFeedback={canSend[area] || isOwner}
          />
        </Section>
      ))}
      {seesAds && areas.includes("trafego") && (
        <Section title="PDFs dos relatórios de anúncios">
          <ReportFiles clientId={id} files={files} />
        </Section>
      )}
    </div>
  );
}
