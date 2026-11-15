"use client";

import { useTransition, type ReactNode } from "react";
import { LoaderCircle, RefreshCw, Unplug } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { connectionLabel } from "@/domain/integrations";
import { formatDateTime } from "@/domain/shared/dates";
import { disconnect, refreshAccounts } from "@/features/integrations/actions";
import type { ConnectionView } from "@/features/integrations/queries";
import { handleResult } from "@/lib/action-feedback";
import { cn } from "@/lib/utils";

const METHOD: Record<ConnectionView["method"], string> = { oauth: "Login", system_user: "Usuário do sistema do BM" };

/** Situação de uma conexão com as ações: buscar contas, reconectar e desconectar. */
export function ConnectionPanel({
  conn,
  title,
  reconnectHref,
  showAccounts = true,
  extra,
}: {
  conn: ConnectionView;
  title: string;
  reconnectHref?: string;
  showAccounts?: boolean;
  extra?: ReactNode;
}) {
  const [pending, run] = useTransition();
  const label = connectionLabel({ status: conn.status, expiresAt: conn.expiresAt, hasRefresh: conn.provider === "google" });
  const bad = label === "Expirada" || label === "Com erro";
  return (
    <div className="grid gap-3">
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
        <dt className="text-muted-foreground">Situação</dt>
        <dd>
          <span className={cn("inline-flex items-center gap-1.5 font-medium", bad ? "text-danger" : label.startsWith("Vence") ? "text-warning" : "text-success")}>
            <span className={cn("size-2 rounded-full", bad ? "bg-danger" : label.startsWith("Vence") ? "bg-warning" : "bg-success")} aria-hidden="true" />
            {label}
          </span>
        </dd>
        <dt className="text-muted-foreground">Conta conectada</dt>
        <dd className="min-w-0 break-words">
          {conn.accountName ?? "—"}
          {conn.accountEmail && conn.accountEmail !== conn.accountName && <span className="text-muted-foreground"> ({conn.accountEmail})</span>}
        </dd>
        {conn.provider === "meta" && (
          <>
            <dt className="text-muted-foreground">Forma</dt>
            <dd>{METHOD[conn.method]}{conn.expiresAt ? ` · vale até ${formatDateTime(conn.expiresAt)}` : " · sem data para vencer"}</dd>
          </>
        )}
        {showAccounts && (
          <>
            <dt className="text-muted-foreground">Contas buscadas</dt>
            <dd>{conn.accountsSyncedAt ? formatDateTime(conn.accountsSyncedAt) : "Ainda não"}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Conectado por</dt>
        <dd>{conn.connectedByName ?? "—"} em {formatDateTime(conn.createdAt)}</dd>
      </dl>
      {conn.lastError && (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
          {conn.lastError}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {showAccounts && (
          <Button variant="outline" disabled={pending} onClick={() => run(async () => void handleResult(await refreshAccounts({ connectionId: conn.id })))}>
            {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />} Buscar contas de novo
          </Button>
        )}
        {reconnectHref && (
          <a href={reconnectHref} className={buttonVariants({ variant: bad ? "default" : "outline" })}>
            Reconectar
          </a>
        )}
        {extra}
        <ConfirmDialog
          trigger={
            <Button variant="ghost" className="text-danger" disabled={pending}>
              <Unplug aria-hidden="true" /> Desconectar
            </Button>
          }
          title={`Desconectar ${title}?`}
          description={
            showAccounts
              ? "O acesso é revogado e os dados das contas param de chegar. As contas e os vínculos com clientes continuam salvos para quando conectar de novo."
              : "O acesso é revogado. Os eventos que já estão na sua agenda do Google continuam lá."
          }
          confirmLabel="Desconectar"
          onConfirm={async () => handleResult(await disconnect({ connectionId: conn.id }))}
        />
      </div>
    </div>
  );
}
