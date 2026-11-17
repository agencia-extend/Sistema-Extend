"use client";

import { useTransition } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { refreshSocial } from "@/features/social/actions";
import { handleResult } from "@/lib/action-feedback";

/** Busca de novo na Meta (de um cliente ou todas as páginas). Pode levar alguns segundos. */
export function RefreshSocialButton({ clientId, label }: { clientId: string | null; label: string }) {
  const [pending, run] = useTransition();
  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={() => run(async () => void handleResult(await refreshSocial({ clientId })))}>
      {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
      {pending ? "Buscando na Meta…" : label}
    </Button>
  );
}
