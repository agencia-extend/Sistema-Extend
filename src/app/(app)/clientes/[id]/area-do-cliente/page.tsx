import Link from "next/link";
import { Eye, FileText, FolderOpen } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { listFiles } from "@/features/clients/queries";
import { canManagePortal, getStrategy, portalPeople } from "@/features/portal/queries";
import { Section } from "@/features/clients/components/section";
import { PortalPeople } from "@/features/portal/components/portal-people";
import { StrategyEditor } from "@/features/portal/components/strategy-editor";
import { Button } from "@/components/ui/button";

/** Aba "Área do cliente" no ambiente do cliente: quem do cliente tem acesso, a estratégia publicada e o que é compartilhado. */
export default async function AreaDoClientePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("clients.read");
  const { id } = await params;
  const [people, strategy, canManage, files] = await Promise.all([portalPeople(id), getStrategy(id), canManagePortal(id), listFiles(id)]);
  const reports = files.filter((f) => f.folder === "relatorios").length;
  const shared = files.filter((f) => f.folder === "cliente").length;

  return (
    <div className="grid max-w-4xl grid-cols-[minmax(0,1fr)] gap-8">
      <div className="grid gap-3 rounded-xl border bg-surface p-4 text-sm">
        <p className="max-w-prose">
          A pessoa do cliente entra com e-mail e senha e vê <strong>só este cliente</strong>: andamento do mês, cronograma de posts, conteúdos para aprovar,
          relatórios, arquivos compartilhados e a estratégia publicada.
        </p>
        <p className="max-w-prose text-muted-foreground">
          Ela nunca vê valores do contrato, comentários e notas internas, a ficha de onboarding, a equipe por setor nem outros clientes.
        </p>
        <Button asChild variant="outline" className="justify-self-start">
          <Link href={`/portal/previa/${id}`} prefetch={false}><Eye aria-hidden="true" /> Ver como o cliente</Link>
        </Button>
      </div>

      <Section title="Pessoas com acesso">
        <PortalPeople clientId={id} people={people} canManage={canManage} />
      </Section>

      <Section title="Estratégia e planejamento">
        <StrategyEditor clientId={id} strategy={strategy} canManage={canManage} />
      </Section>

      <Section title="Arquivos compartilhados">
        <ul className="grid gap-2 sm:grid-cols-2">
          <li>
            <Link href={`/clientes/${id}/arquivos?pasta=relatorios`} className="flex items-center gap-3 rounded-xl border bg-card p-4 hover:bg-muted/50">
              <FileText className="size-5 text-brand" aria-hidden="true" />
              <span className="grid">
                <span className="text-sm font-medium">Relatórios</span>
                <span className="text-xs text-muted-foreground tabular">{reports === 1 ? "1 arquivo" : `${reports} arquivos`} em Documentos › Relatórios</span>
              </span>
            </Link>
          </li>
          <li>
            <Link href={`/clientes/${id}/arquivos?pasta=cliente`} className="flex items-center gap-3 rounded-xl border bg-card p-4 hover:bg-muted/50">
              <FolderOpen className="size-5 text-brand" aria-hidden="true" />
              <span className="grid">
                <span className="text-sm font-medium">Para o cliente</span>
                <span className="text-xs text-muted-foreground tabular">{shared === 1 ? "1 arquivo" : `${shared} arquivos`} em Documentos › Para o cliente</span>
              </span>
            </Link>
          </li>
        </ul>
        <p className="text-xs text-muted-foreground">Conteúdos concluídos com link final do Drive também aparecem para o cliente baixar, em Materiais.</p>
      </Section>
    </div>
  );
}
