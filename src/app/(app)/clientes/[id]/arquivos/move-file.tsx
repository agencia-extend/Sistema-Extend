"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FILE_FOLDERS, FILE_FOLDER_LABEL, type FileFolder } from "@/domain/clients";
import { moveFile } from "@/features/clients/actions";
import { handleResult } from "@/lib/action-feedback";

/** Mover o documento para outra pasta de setor. */
export function MoveFile({ id, clientId, name, folder }: { id: string; clientId: string; name: string; folder: FileFolder }) {
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
      <SelectContent>{FILE_FOLDERS.map((k) => <SelectItem key={k} value={k}>{FILE_FOLDER_LABEL[k]}</SelectItem>)}</SelectContent>
    </Select>
  );
}
