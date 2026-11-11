"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Archive, ChevronDown, Pause, Play, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { archiveClient, setClientStatus } from "@/features/clients/actions";
import { handleResult } from "@/lib/action-feedback";
import type { ClientStatus } from "@/domain/clients";

export function StatusMenu({ clientId, status, canArchive }: { clientId: string; status: ClientStatus; canArchive: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const set = (s: "ativo" | "pausado" | "encerrado") => startTransition(async () => void handleResult(await setClientStatus({ clientId, status: s })));
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={pending}>
            Status <ChevronDown aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {status !== "ativo" && (
            <DropdownMenuItem onSelect={() => set("ativo")}>
              <Play aria-hidden="true" /> Reativar
            </DropdownMenuItem>
          )}
          {status === "ativo" && (
            <DropdownMenuItem onSelect={() => set("pausado")}>
              <Pause aria-hidden="true" /> Pausar
            </DropdownMenuItem>
          )}
          {status !== "encerrado" && (
            <DropdownMenuItem onSelect={() => set("encerrado")}>
              <XCircle aria-hidden="true" /> Encerrar contrato
            </DropdownMenuItem>
          )}
          {canArchive && <DropdownMenuSeparator />}
        </DropdownMenuContent>
      </DropdownMenu>
      {canArchive && (
        <ConfirmDialog
          trigger={
            <Button variant="ghost" disabled={pending}>
              <Archive aria-hidden="true" /> Arquivar
            </Button>
          }
          title="Arquivar este cliente?"
          description="Ele some das listas. O histórico, as demandas e a auditoria continuam guardados."
          confirmLabel="Arquivar cliente"
          onConfirm={async () => {
            const res = await archiveClient({ clientId });
            if (handleResult(res)) router.push("/clientes");
            return res.ok;
          }}
        />
      )}
    </>
  );
}
