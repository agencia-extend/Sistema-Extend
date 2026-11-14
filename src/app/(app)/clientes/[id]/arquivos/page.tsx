import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { getClient, listFiles } from "@/features/clients/queries";
import { EmptyState } from "@/components/app/states";
import { formatDateTime } from "@/domain/shared/dates";
import { FILE_FOLDERS, FILE_FOLDER_LABEL, SHARED_FOLDERS, type FileFolder } from "@/domain/clients";
import { canManagePortal } from "@/features/portal/queries";
import { FileLink, UploadButton } from "@/features/clients/components/files";
import { cn } from "@/lib/utils";
import { DeleteFileButton } from "./delete-file";
import { MoveFile } from "./move-file";

const CATEGORY: Record<string, string> = {
  geral: "Geral",
  fechamento: "Fechamento",
  reuniao: "Reunião",
  identidade: "Identidade visual",
  contrato: "Contrato",
  referencia: "Referência",
};

const size = (b: number | null) => (b == null ? "" : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB`);

/** Documentos do cliente em pastas por setor (Geral, Mídias, Tráfego) e as pastas que o cliente vê (Relatórios, Para o cliente). */
export default async function ArquivosPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pasta?: string }> }) {
  const user = await requirePermission("clients.read");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const folder: FileFolder = FILE_FOLDERS.includes(sp.pasta as FileFolder) ? (sp.pasta as FileFolder) : "geral";
  const [client, all, canShare] = await Promise.all([getClient(id), listFiles(id), canManagePortal(id)]);
  const shared = SHARED_FOLDERS.includes(folder);
  const files = all.filter((f) => f.folder === folder);
  const canManage = Boolean(user.permissions["clients.manage"] || user.permissions["clients.onboarding.manage"]);
  const drive = (client?.client_accounts ?? []).find((a) => a.kind === "drive_folder");

  return (
    <div className="grid max-w-4xl grid-cols-[minmax(0,1fr)] gap-5">
      <p className="max-w-prose text-sm text-muted-foreground">
        Documentos leves (prints, PDFs, contratos, planilhas) até 10 MB, separados por setor. Vídeos e arquivos grandes ficam no Drive do cliente.
        {drive && (
          <>
            {" "}
            <a href={drive.value} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">Abrir pasta do Drive</a>
          </>
        )}
      </p>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b">
        <nav aria-label="Pastas" className="-mb-px flex max-w-full min-w-0 gap-1 overflow-x-auto">
          {FILE_FOLDERS.map((k) => {
            const n = all.filter((f) => f.folder === k).length;
            return (
              <Link
                key={k}
                href={k === "geral" ? `/clientes/${id}/arquivos` : `/clientes/${id}/arquivos?pasta=${k}`}
                aria-current={folder === k ? "page" : undefined}
                scroll={false}
                className={cn("flex min-h-10 items-center border-b-2 px-3 text-sm whitespace-nowrap", folder === k ? "border-brand font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}
              >
                {FILE_FOLDER_LABEL[k]} <span className="ml-1 tabular text-muted-foreground">({n})</span>
              </Link>
            );
          })}
        </nav>
        {(!shared || canShare) && (
          <div className="mb-2 flex gap-2">
            <UploadButton clientId={id} category="geral" folder={folder} label={`Enviar para ${FILE_FOLDER_LABEL[folder]}`} variant="default" />
          </div>
        )}
      </div>
      {shared && (
        <p role="note" className="rounded-lg border border-info/30 bg-info-soft p-3 text-sm text-info">
          O cliente vê os arquivos desta pasta na área do cliente e é avisado quando um arquivo novo chega.
          {!canShare && " Só quem gerencia a área do cliente envia arquivos para cá."}
        </p>
      )}
      {files.length === 0 ? (
        <EmptyState icon={FolderOpen} title={`Nenhum documento em ${FILE_FOLDER_LABEL[folder]}`} description={folder === "relatorios" ? "Envie o PDF do relatório do mês: o cliente baixa pela área do cliente." : folder === "cliente" ? "Envie aqui o que o cliente deve receber (apresentações, artes finais leves, documentos)." : "Envie contratos, prints da negociação, relatórios ou planilhas deste setor."} />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {files.map((f) => {
            const mine = canManage || f.uploaded_by === user.id;
            return (
              <li key={f.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="grid min-w-0 flex-1 basis-60 gap-1">
                  <FileLink path={f.storage_path} name={f.name} />
                  <span className="text-xs text-muted-foreground">
                    {[CATEGORY[f.category] ?? f.category, size(f.size_bytes), f.author, formatDateTime(f.created_at)].filter(Boolean).join(" · ")}
                  </span>
                </div>
                {mine && (!shared || canShare) && <MoveFile id={f.id} clientId={id} name={f.name} folder={folder} canShare={canShare} />}
                {mine && <DeleteFileButton id={f.id} clientId={id} name={f.name} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
