"use client";

import { useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setLibraryStatus } from "@/features/creatives/actions";
import { handleResult } from "@/lib/action-feedback";

/** Sugestão do sistema (RF-BIB-02): um anúncio ligado está com alerta de fadiga em aberto. */
export function FatigueSuggestion({ libraryId, angle, canEdit }: { libraryId: string; angle: string; canEdit: boolean }) {
  const [pending, run] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/40 bg-warning-soft/50 px-2.5 py-1.5 text-xs">
      <span>Sugestão: fadigado (frequência alta e CTR caindo).</span>
      {canEdit && (
        <Button size="sm" variant="outline" className="h-7" disabled={pending} aria-label={`Marcar ${angle} como fadigado`}
          onClick={() => run(async () => void handleResult(await setLibraryStatus({ id: libraryId, status: "fadigado" })))}>
          {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Marcar como fadigado
        </Button>
      )}
    </div>
  );
}
