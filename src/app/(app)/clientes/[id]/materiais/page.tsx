import { ExternalLink, Library } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { listMaterials } from "@/features/clients/queries";
import { EmptyState } from "@/components/app/states";
import { MATERIAL_CATEGORIES, MATERIAL_CATEGORY } from "@/domain/clients";
import { formatDate } from "@/domain/shared/dates";
import { FileLink } from "@/features/clients/components/files";
import { MaterialDialog } from "@/features/clients/components/material-dialog";
import { DeleteMaterialButton } from "./delete-material";

/** Materiais do cliente por categoria: identidade, catálogo, instruções, imagens, referências e acessos. */
export default async function MateriaisPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("clients.read");
  const { id } = await params;
  const materials = await listMaterials(id);
  const canManage = Boolean(user.permissions["clients.manage"] || user.permissions["clients.onboarding.manage"]);
  const groups = MATERIAL_CATEGORIES.map((c) => ({ c, items: materials.filter((m) => m.category === c) })).filter((g) => g.items.length);

  return (
    <div className="grid max-w-4xl gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-sm text-muted-foreground">Tudo o que a equipe precisa do cliente para produzir: logo, manual, catálogo, fotos, referências e acessos. Cada material é um arquivo ou um link do Drive.</p>
        <MaterialDialog clientId={id} />
      </div>
      {groups.length === 0 ? (
        <EmptyState icon={Library} title="Nenhum material ainda" description="Comece pela identidade visual: logo em alta e manual de marca. Depois catálogo, fotos e referências." />
      ) : (
        groups.map(({ c, items }) => (
          <section key={c} aria-labelledby={`mat-${c}`} className="grid gap-2">
            <div className="grid gap-0.5">
              <h2 id={`mat-${c}`} className="text-base font-semibold">{MATERIAL_CATEGORY[c].label}</h2>
              <p className="text-xs text-muted-foreground">{MATERIAL_CATEGORY[c].hint}</p>
            </div>
            <ul className="divide-y rounded-xl border bg-card">
              {items.map((m) => (
                <li key={m.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
                  <div className="grid min-w-0 flex-1 basis-60 gap-1.5">
                    <span className="text-sm font-medium break-words">{m.title}</span>
                    <div className="flex flex-wrap gap-2">
                      {m.file && <FileLink path={m.file.path} name={m.file.name} />}
                      {m.url && (
                        <a href={m.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs hover:bg-muted">
                          <ExternalLink className="size-3.5" aria-hidden="true" /> Abrir link
                        </a>
                      )}
                    </div>
                    {m.notes && <p className="text-sm break-words whitespace-pre-line text-muted-foreground">{m.notes}</p>}
                    <span className="text-xs text-muted-foreground">{[m.author, formatDate(m.createdAt)].filter(Boolean).join(" · ")}</span>
                  </div>
                  {(canManage || m.createdBy === user.id) && <DeleteMaterialButton id={m.id} clientId={id} title={m.title} />}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
