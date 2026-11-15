"use client";

import { useTransition } from "react";
import { BellRing, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendTestNotification, setUserActive } from "@/features/admin/actions";
import type { OpenWork } from "@/features/admin/queries";
import { handleResult } from "@/lib/action-feedback";
import { DeactivateDialog } from "./deactivate-dialog";

export function UserActions({ userId, name, active, canToggle, work, successors }: {
  userId: string;
  name: string;
  active: boolean;
  canToggle: boolean;
  work: OpenWork | null;
  successors: { id: string; name: string; crm: boolean }[];
}) {
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
          work && <DeactivateDialog userId={userId} name={name} work={work} people={successors} />
        ) : (
          <Button disabled={pending} onClick={() => startTransition(async () => void handleResult(await setUserActive({ userId, active: true })))}>
            <Power aria-hidden="true" /> Reativar acesso
          </Button>
        ))}
    </>
  );
}
