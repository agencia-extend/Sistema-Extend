"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FILE_FOLDERS, FILE_FOLDER_LABEL, SHARED_FOLDERS, type FileFolder } from "@/domain/clients";
import { moveFile } from "@/features/clients/actions";
import { handleResult } from "@/lib/action-feedback";

/** Mover o documento para outra pasta (as pastas do cliente só para quem gerencia a área do cliente). */
export function MoveFile({ id, clientId, name, folder, canShare }: { id: string; clientId: string; name: string; folder: FileFolder; canShare: boolean }) {
  const options = FILE_FOLDERS.filter((k) => canShare || k === folder || !SHARED_FOLDERS.includes(k));
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Select
      value={folder}
      disabled={pending}
      onValueChange={(v) =>
        start(async () => {
          if (handleResult(await moveFile({ id, clientId, folder: v as FileFolder }))) router.refresh();
        })
      }
    >
      <SelectTrigger size="sm" className="h-8 w-36" aria-label={`Pasta de ${name}`}><SelectValue /></SelectTrigger>
      <SelectContent>{options.map((k) => <SelectItem key={k} value={k}>{FILE_FOLDER_LABEL[k]}</SelectItem>)}</SelectContent>
    </Select>
  );
}
