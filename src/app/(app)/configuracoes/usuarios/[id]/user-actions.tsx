"use client";

import { useTransition } from "react";
import { BellRing, Power, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { sendTestNotification, setUserActive } from "@/features/admin/actions";
import { handleResult } from "@/lib/action-feedback";

export function UserActions({ userId, name, active, canToggle }: { userId: string; name: string; active: boolean; canToggle: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <>
      {active && (
        <Button variant="outline" disabled={pending} onClick={() => startTransition(async () => void handleResult(await sendTestNotification({ userId })))}>
          <BellRing aria-hidden="true" /> Notificação de teste
        </Button>
      )}
      {canToggle &&
        (active ? (
          <ConfirmDialog
            trigger={
              <Button variant="destructive" disabled={pending}>
                <PowerOff aria-hidden="true" /> Desativar acesso
              </Button>
            }
            title={`Desativar o acesso de ${name}?`}
            description="A pessoa é desconectada de todos os aparelhos e não consegue mais entrar. O histórico dela continua no sistema. Você pode reativar depois."
            confirmLabel="Desativar acesso"
            onConfirm={async () => handleResult(await setUserActive({ userId, active: false }))}
          />
        ) : (
          <Button disabled={pending} onClick={() => startTransition(async () => void handleResult(await setUserActive({ userId, active: true })))}>
            <Power aria-hidden="true" /> Reativar acesso
          </Button>
        ))}
    </>
  );
}
