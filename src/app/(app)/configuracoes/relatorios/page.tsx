import type { Metadata } from "next";
import { FileText, Pencil, Plus } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/domain/shared/dates";
import { TemplateEditor } from "@/features/ads/components/template-editor";
import { listReportTemplates } from "@/features/ads/report-queries";
import { requirePermission } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Relatórios" };

/** RF-REL-02: modelos de relatório de anúncios com variáveis. Edita quem configura os relatórios de todos os clientes. */
export default async function RelatoriosConfigPage() {
  const user = await requirePermission("reports.manage");
  const canEdit = user.permissions["reports.manage"] === "all";
  const templates = await listReportTemplates();

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Modelos do relatório de anúncios que vai para o grupo de relatórios do WhatsApp. Cada cliente usa o modelo escolhido na aba Anúncios dele, ou o padrão da agência."
        actions={canEdit ? <TemplateEditor template={null} trigger={<Button><Plus aria-hidden="true" /> Novo modelo</Button>} /> : undefined}
      />
      <PageBody className="grid max-w-4xl gap-4">
        {!canEdit && <p className="text-sm text-muted-foreground">Só quem configura os relatórios de todos os clientes cria e edita modelos. Você escolhe o modelo de cada cliente seu na aba Anúncios dele.</p>}
        <ul aria-label="Modelos de relatório" className="grid gap-3">
          {templates.map((t) => (
            <li key={t.id} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="grid min-w-0 gap-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span className="break-words">{t.name}</span>
                  {t.isDefault && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Padrão da agência</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.clients ? `${t.clients} ${t.clients === 1 ? "cliente escolheu" : "clientes escolheram"} este modelo` : t.isDefault ? "Usado por todos os clientes sem modelo próprio" : "Nenhum cliente usa ainda"} · alterado em {formatDateTime(t.updatedAt)}
                </p>
                <pre className="mt-1 max-h-32 overflow-hidden font-sans text-xs break-words whitespace-pre-wrap text-muted-foreground">{t.body}</pre>
              </div>
              {canEdit && (
                <TemplateEditor template={t} trigger={<Button variant="outline" size="sm" aria-label={`Editar ${t.name}`}><Pencil aria-hidden="true" /> Editar</Button>} />
              )}
            </li>
          ))}
        </ul>
      </PageBody>
    </>
  );
}
