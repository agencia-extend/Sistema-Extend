"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Archive, ArchiveRestore, Copy, History, LoaderCircle, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { duplicateTemplate, restoreTemplateVersion, setTemplateFlags } from "@/features/proposals/actions";
import { handleResult } from "@/lib/action-feedback";

export function TemplateActions({ id, isDefault, archived }: { id: string; isDefault: boolean; archived: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<boolean>) => start(async () => void (await fn()));
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={pending} onClick={() => run(async () => {
        const res = await duplicateTemplate({ id });
        if (handleResult(res) && res.ok) router.push(`/configuracoes/propostas/${res.data.id}`);
        return res.ok;
      })}>
        {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Copy aria-hidden="true" />} Duplicar
      </Button>
      {!isDefault && !archived && (
        <Button variant="outline" disabled={pending} onClick={() => run(async () => { const ok = handleResult(await setTemplateFlags({ id, isDefault: true })); if (ok) router.refresh(); return ok; })}>
          <Star aria-hidden="true" /> Usar como padrão
        </Button>
      )}
      {!isDefault && (
        <Button variant="ghost" disabled={pending} onClick={() => run(async () => { const ok = handleResult(await setTemplateFlags({ id, archived: !archived })); if (ok) router.refresh(); return ok; })}>
          {archived ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />} {archived ? "Reativar" : "Arquivar"}
        </Button>
      )}
    </div>
  );
}

export function RestoreVersion({ id, version }: { id: string; version: number }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      tone="default"
      trigger={<Button variant="ghost" size="sm"><History aria-hidden="true" /> Restaurar<span className="sr-only"> a versão {version}</span></Button>}
      title={`Restaurar a versão ${version}?`}
      description="O conteúdo dessa versão volta a valer como uma versão nova. Propostas já criadas não mudam."
      confirmLabel="Restaurar"
      onConfirm={async () => {
        const ok = handleResult(await restoreTemplateVersion({ id, version }));
        if (ok) router.refresh();
        return ok;
      }}
    />
  );
}
