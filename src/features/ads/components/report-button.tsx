"use client";

import { useTransition } from "react";
import { LoaderCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendReportNow } from "@/features/ads/actions";
import type { Period } from "@/domain/ads";
import { handleResult } from "@/lib/action-feedback";

/** Manda o relatório do período da tela para o grupo de relatórios (o gestor encaminha ao cliente). */
export function ReportButton({ clientId, period }: { clientId: string; period: Period }) {
  const [pending, run] = useTransition();
  return (
    <Button size="sm" disabled={pending} onClick={() => run(async () => void handleResult(await sendReportNow({ clientId, period })))}>
      {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
      {pending ? "Enviando…" : "Enviar relatório"}
    </Button>
  );
}
