"use client";

import { useTransition } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { syncAdsNow } from "@/features/ads/actions";
import { handleResult } from "@/lib/action-feedback";

/** Busca agora os números da Meta (a sincronização automática roda a cada 3 horas). */
export function SyncButton({ clientId }: { clientId: string | null }) {
  const [pending, run] = useTransition();
  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={() => run(async () => void handleResult(await syncAdsNow({ clientId })))}>
      {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
      {pending ? "Sincronizando…" : "Sincronizar agora"}
    </Button>
  );
}
