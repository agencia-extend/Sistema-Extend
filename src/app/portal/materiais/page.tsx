import type { Metadata } from "next";
import { ExternalLink, FolderOpen } from "lucide-react";
import { requirePortal } from "@/lib/auth/dal";
import { portalFiles } from "@/features/portal/queries";
import { PortalFileList } from "@/features/portal/components/file-list";
import { EmptyState } from "@/components/app/states";
import { FORMAT_LABEL } from "@/domain/media";
import { formatDate } from "@/domain/shared/dates";

export const metadata: Metadata = { title: "Materiais" };

/** Materiais para baixar: arquivos compartilhados e conteúdos prontos (link final no Drive). */
export default async function PortalMaterialsPage() {
  const { clientId } = await requirePortal();
  const { files, contents } = await portalFiles(clientId);
  const shared = files.filter((f) => f.folder === "cliente");

  return (
    <>
      <header className="grid gap-1">
        <h1 className="font-heading text-2xl font-semibold">Materiais</h1>
        <p className="text-sm text-muted-foreground">Arquivos que a agência compartilhou com você e os conteúdos prontos para baixar.</p>
      </header>

      {shared.length === 0 && contents.length === 0 ? (
        <EmptyState icon={FolderOpen} title="Nenhum material ainda" description="Quando a equipe concluir conteúdos ou compartilhar arquivos, eles aparecem aqui." />
      ) : (
        <>
          {shared.length > 0 && (
            <section aria-labelledby="arquivos" className="grid gap-3">
              <h2 id="arquivos" className="text-base font-semibold">Arquivos da agência</h2>
              <PortalFileList files={shared} />
            </section>
          )}
          {contents.length > 0 && (
            <section aria-labelledby="prontos" className="grid gap-3">
              <h2 id="prontos" className="text-base font-semibold">Conteúdos prontos</h2>
              <ul className="divide-y rounded-xl border bg-card">
                {contents.map((c, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                    <div className="grid min-w-0 flex-1 basis-48 gap-0.5">
                      <span className="text-sm font-medium break-words">{c.title}</span>
                      <span className="text-xs text-muted-foreground">{[c.format ? FORMAT_LABEL[c.format] : null, formatDate(c.at)].filter(Boolean).join(" · ")}</span>
                    </div>
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-muted">
                      <ExternalLink className="size-4" aria-hidden="true" /> Abrir no Drive
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  );
}
