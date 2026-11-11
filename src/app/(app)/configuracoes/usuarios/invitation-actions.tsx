"use client";

import { useTransition } from "react";
import { RotateCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { cancelInvitation, resendInvitation } from "@/features/admin/invitations";
import { handleResult } from "@/lib/action-feedback";

export function InvitationActions({ id, email }: { id: string; email: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" disabled={pending} onClick={() => startTransition(async () => void handleResult(await resendInvitation({ id })))}>
        <RotateCw aria-hidden="true" /> Reenviar
      </Button>
      <ConfirmDialog
        trigger={
          <Button variant="ghost" size="sm" disabled={pending}>
            <X aria-hidden="true" /> Revogar
          </Button>
        }
        title="Revogar convite?"
        description={`O link enviado para ${email} deixa de funcionar. Você pode convidar de novo depois.`}
        confirmLabel="Revogar convite"
        onConfirm={async () => handleResult(await cancelInvitation({ id }))}
      />
    </div>
  );
}
