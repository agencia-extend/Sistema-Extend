import { FolderOpen } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { getClient, listFiles } from "@/features/clients/queries";
import { EmptyState } from "@/components/app/states";
import { formatDateTime } from "@/domain/shared/dates";
import { FileLink, UploadButton } from "@/features/clients/components/files";
import { DeleteFileButton } from "./delete-file";

const CATEGORY: Record<string, string> = {
  geral: "Geral",
  fechamento: "Fechamento",
  reuniao: "Reunião",
  identidade: "Identidade visual",
  contrato: "Contrato",
  referencia: "Referência",
};

const size = (b: number | null) => (b == null ? "" : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB`);

export default async function ArquivosPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("clients.read");
  const { id } = await params;
  const [client, files] = await Promise.all([getClient(id), listFiles(id)]);
  const canManage = Boolean(user.permissions["clients.manage"] || user.permissions["clients.onboarding.manage"]);
  const drive = (client?.client_accounts ?? []).find((a) => a.kind === "drive_folder");

  return (
    <div className="grid max-w-4xl gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-prose text-sm text-muted-foreground">
          Anexos leves (prints, PDFs, contratos, referências) até 10 MB. Vídeos e arquivos grandes ficam no Drive do cliente.
          {drive && (
            <>
              {" "}
              <a href={drive.value} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">Abrir pasta do Drive</a>
            </>
          )}
        </p>
        <div className="flex gap-2">
          <UploadButton clientId={id} category="identidade" label="Identidade visual" variant="outline" />
          <UploadButton clientId={id} category="geral" label="Enviar arquivo" variant="default" />
        </div>
      </div>
      {files.length === 0 ? (
        <EmptyState icon={FolderOpen} title="Nenhum arquivo ainda" description="Envie o contrato, prints da negociação, manual de marca ou referências." />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {files.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
              <div className="grid min-w-0 flex-1 basis-60 gap-1">
                <FileLink path={f.storage_path} name={f.name} />
                <span className="text-xs text-muted-foreground">
                  {[CATEGORY[f.category] ?? f.category, size(f.size_bytes), f.author, formatDateTime(f.created_at)].filter(Boolean).join(" · ")}
                </span>
              </div>
              {(canManage || f.uploaded_by === user.id) && <DeleteFileButton id={f.id} clientId={id} name={f.name} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
