"use client";

import { Copy, CopyPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { googleTrackingTemplate, UTM_PLATFORM_LABEL, utmQuery } from "@/domain/traffic/utm";
import { deleteUtmLink } from "@/features/traffic/actions";
import type { UtmLinkRow } from "@/features/traffic/queries";
import { handleResult } from "@/lib/action-feedback";
import { formatDate } from "@/domain/shared/dates";
import { UtmDialog } from "./utm-dialog";

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copiado.`);
  } catch {
    toast.error("Não foi possível copiar. Selecione o texto e copie.");
  }
}

/** Links gerados para o cliente: copiar o link (ou só os parâmetros / o modelo do Google), gerar um parecido e apagar. */
export function UtmList({ clientId, rows, canManage }: { clientId: string; rows: UtmLinkRow[]; canManage: boolean }) {
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {rows.map((r) => {
        const params = { source: r.source, medium: r.medium, campaign: r.campaign, term: r.term ?? "", content: r.content ?? "" };
        return (
          <li key={r.id} className="grid gap-2 px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="min-w-0 text-sm font-medium break-words">{r.label}</p>
              <p className="text-xs text-muted-foreground">
                {UTM_PLATFORM_LABEL[r.platform].split(" (")[0]} · {formatDate(r.createdAt)}{r.authorName ? ` · ${r.authorName}` : ""}
              </p>
            </div>
            <p className="rounded-md bg-muted/50 px-2 py-1.5 text-xs break-all">{r.url}</p>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="outline" onClick={() => copy(r.url, "Link")} aria-label={`Copiar o link: ${r.label}`}>
                <Copy aria-hidden="true" /> Copiar link
              </Button>
              {r.platform === "meta" && (
                <Button size="sm" variant="ghost" onClick={() => copy(utmQuery(params), "Parâmetros")} aria-label={`Copiar os parâmetros de URL: ${r.label}`}>
                  Copiar parâmetros
                </Button>
              )}
              {r.platform === "google" && (
                <Button size="sm" variant="ghost" onClick={() => copy(googleTrackingTemplate(params), "Modelo")} aria-label={`Copiar o modelo de acompanhamento: ${r.label}`}>
                  Copiar modelo de acompanhamento
                </Button>
              )}
              {canManage && (
                <>
                  <UtmDialog
                    clientId={clientId}
                    initial={{ label: r.label, platform: r.platform, baseUrl: r.baseUrl, ...params }}
                    trigger={<Button size="sm" variant="ghost" aria-label={`Gerar um link parecido com: ${r.label}`}><CopyPlus aria-hidden="true" /> Gerar parecido</Button>}
                  />
                  <ConfirmDialog
                    trigger={<Button size="icon" variant="ghost" className="ml-auto text-danger" aria-label={`Apagar o link: ${r.label}`}><Trash2 /></Button>}
                    title="Apagar este link?"
                    description="Ele sai da lista. Anúncios e posts que já usam o link continuam funcionando."
                    confirmLabel="Apagar"
                    onConfirm={async () => handleResult(await deleteUtmLink({ id: r.id, clientId }))}
                  />
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
