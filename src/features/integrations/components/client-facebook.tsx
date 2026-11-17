"use client";

import { useState, useTransition } from "react";
import { Copy, Link2, LoaderCircle, MessageCircle, X } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { formatDateTime } from "@/domain/shared/dates";
import { createClientConnectLink, revokeClientConnectLink, toggleClientAdAccount } from "@/features/integrations/actions";
import type { ClientFacebook as Data } from "@/features/integrations/queries";
import { handleResult } from "@/lib/action-feedback";
import { ConnectionPanel } from "./connection-panel";

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Link copiado.");
  } catch {
    toast.error("Não foi possível copiar. Selecione o link e copie.");
  }
}

/**
 * Facebook do cliente (contas de anúncio no perfil do cliente, fora do BM da Extend): o gestor conecta
 * entrando com o Facebook do cliente, ou gera um link para o próprio cliente autorizar.
 */
export function ClientFacebook({ clientId, clientName, data, canManage }: { clientId: string; clientName: string; data: Data; canManage: boolean }) {
  const [pending, run] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const connectHref = `/api/integracoes/meta/conectar?para=cliente&cliente=${clientId}`;
  const { connection, link, accounts } = data;

  const makeLink = () =>
    run(async () => {
      const res = await createClientConnectLink({ clientId });
      if (handleResult(res) && res.ok) setUrl((res.data as { url: string }).url);
    });

  if (!data.configured)
    return <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">A conexão com a Meta ainda não está configurada no servidor. Fale com quem administra o sistema.</p>;

  const message = url ? `Olá! Para a Agência Extend acompanhar os resultados dos anúncios de ${clientName}, autorize o acesso de leitura ao seu Facebook neste link (vale 7 dias): ${url}` : "";

  return (
    <div className="grid gap-4">
      {connection ? (
        <div className="rounded-xl border bg-card p-4">
          {canManage ? (
            <ConnectionPanel conn={connection} title={`o Facebook de ${clientName}`} reconnectHref={connectHref} />
          ) : (
            <p className="text-sm">
              Conectado com o Facebook <strong className="font-medium">{connection.accountName ?? "do cliente"}</strong>
              {connection.expiresAt ? `, vale até ${formatDateTime(connection.expiresAt)}` : ""}.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-3 rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            Use quando as contas de anúncio estão no Facebook do cliente e não no BM da Extend. O sistema só lê: não publica nem altera anúncios.
          </p>
          {canManage && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={makeLink} disabled={pending}>
                {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Link2 aria-hidden="true" />} Gerar link para o cliente
              </Button>
              <a href={connectHref} className={buttonVariants({ variant: "outline" })}>Conectar agora com o Facebook do cliente</a>
            </div>
          )}
          {canManage && (
            <p className="text-xs text-muted-foreground">
              “Conectar agora” abre o login do Facebook neste navegador: se o seu Facebook estiver aberto, saia dele antes e entre com o do cliente.
            </p>
          )}
        </div>
      )}

      {canManage && !data.appLive && (
        <p className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning">
          Enquanto a Meta não aprova o app da Extend, só conecta quem estiver cadastrado no app (Funções do app › Testadores). Depois da aprovação, qualquer cliente conecta.
        </p>
      )}

      {canManage && url && (
        <div className="grid gap-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-medium">Link para {clientName} (vale 7 dias, uma autorização)</p>
          <output aria-label="Link para o cliente" className="rounded-md bg-background px-2 py-1.5 text-xs break-all">{url}</output>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => copy(url)}><Copy aria-hidden="true" /> Copiar link</Button>
            <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className={buttonVariants({ size: "sm", variant: "outline" })}>
              <MessageCircle aria-hidden="true" /> Enviar no WhatsApp
            </a>
          </div>
          <p className="text-xs text-muted-foreground">Por segurança o link só aparece agora. Se perder, gere outro (o anterior deixa de valer).</p>
        </div>
      )}

      {canManage && link && !url && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
          <span>Link enviado em {formatDateTime(link.createdAt)}, aguardando o cliente (vale até {formatDateTime(link.expiresAt)}).</span>
          <span className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={makeLink} disabled={pending}>Gerar outro</Button>
            <ConfirmDialog
              trigger={<Button size="sm" variant="ghost" className="text-danger" aria-label="Cancelar o link"><X aria-hidden="true" /> Cancelar</Button>}
              title="Cancelar o link?"
              description="O cliente não consegue mais autorizar por ele. Você pode gerar outro quando quiser."
              confirmLabel="Cancelar link"
              onConfirm={async () => handleResult(await revokeClientConnectLink({ id: link.id, clientId }))}
            />
          </span>
        </div>
      )}

      {accounts.length > 0 && (
        <ul className="divide-y rounded-xl border bg-card" aria-label="Contas de anúncio do cliente na Meta">
          {accounts.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="grid min-w-0">
                <span className="text-sm font-medium break-words">{a.name}</span>
                <span className="text-xs text-muted-foreground">
                  {a.externalId}{a.statusLabel ? ` · ${a.statusLabel}` : ""}{a.viaThis ? " · pelo Facebook do cliente" : " · pelo BM da Extend"}
                </span>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={a.isEnabled}
                  disabled={!canManage || pending}
                  onCheckedChange={(v) => run(async () => void handleResult(await toggleClientAdAccount({ id: a.id, clientId, enabled: v })))}
                  aria-label={`Incluir a conta ${a.name} no sistema`}
                />
                Entra no sistema
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
