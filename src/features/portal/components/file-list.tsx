import { Download, FileText } from "lucide-react";
import type { PortalFile } from "@/features/portal/queries";
import { fileSize } from "@/domain/portal";
import { formatDate } from "@/domain/shared/dates";

/** Arquivos compartilhados com o cliente: abrir no navegador ou baixar (o servidor confere o acesso). */
export function PortalFileList({ files }: { files: PortalFile[] }) {
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {files.map((f) => (
        <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
          <FileText className="size-5 shrink-0 text-brand" aria-hidden="true" />
          <div className="grid min-w-0 flex-1 basis-48 gap-0.5">
            <a href={`/portal/arquivo/arquivo/${f.id}`} target="_blank" rel="noopener" className="text-sm font-medium break-words hover:underline">
              {f.name}
            </a>
            <span className="text-xs text-muted-foreground tabular">{[formatDate(f.created_at), fileSize(f.size)].filter(Boolean).join(" · ")}</span>
          </div>
          <a
            href={`/portal/arquivo/arquivo/${f.id}?baixar`}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-muted"
            aria-label={`Baixar ${f.name}`}
          >
            <Download className="size-4" aria-hidden="true" /> Baixar
          </a>
        </li>
      ))}
    </ul>
  );
}
