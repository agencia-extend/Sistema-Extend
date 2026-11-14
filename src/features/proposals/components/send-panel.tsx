"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Copy, ExternalLink, LoaderCircle, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/app/form-field";
import { whatsappLink } from "@/domain/crm";
import { fillVariables } from "@/domain/proposals";
import { sendProposal } from "@/features/proposals/actions";
import { handleResult } from "@/lib/action-feedback";

/**
 * Enviar (RF-PRO-06): grava a versão que o link mostra e abre o WhatsApp com a mensagem do modelo.
 * Até o número da Extend estar ligado ao sistema (etapa 07), a mensagem sai pelo WhatsApp de quem envia.
 */
export function SendPanel({
  id,
  phone,
  message,
  link,
  pendingVersion,
  disabled,
}: {
  id: string;
  phone: string | null;
  message: string; // já com as variáveis da proposta; falta só {link}
  link: string | null; // link público, quando já foi enviada
  pendingVersion: boolean; // há versão mais nova que a enviada
  disabled?: string | null;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(link);
  const [text, setText] = useState(message);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const ready = Boolean(url) && !pendingVersion;
  const finalText = url ? fillVariables(text, { link: url }) : text;
  const wa = phone ? whatsappLink(phone, finalText) : null;

  const send = () =>
    start(async () => {
      const res = await sendProposal({ id });
      if (handleResult(res) && res.ok) {
        setUrl(res.data.url);
        router.refresh();
      }
    });

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copiado.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Selecione o link e copie manualmente.");
    }
  };

  return (
    <section aria-labelledby="enviar" className="grid gap-3 rounded-xl border bg-card p-4">
      <h2 id="enviar" className="text-sm font-semibold">Enviar ao cliente</h2>
      {disabled ? (
        <p className="text-sm text-muted-foreground">{disabled}</p>
      ) : (
        <>
          {!ready && (
            <>
              <p className="text-sm text-muted-foreground">
                {url ? "Você salvou uma versão nova. Envie de novo para o link mostrar esta versão." : "Ao enviar, o link do cliente passa a mostrar esta versão da proposta."}
              </p>
              <Button onClick={send} disabled={pending} className="justify-self-start">
                {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />} {url ? "Enviar esta versão" : "Enviar proposta"}
              </Button>
            </>
          )}
          {url && (
            <div className="grid gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <input readOnly value={url} aria-label="Link da proposta" className="h-9 min-w-0 flex-1 rounded-md border bg-surface px-2 text-xs" onFocus={(e) => e.currentTarget.select()} />
                <Button type="button" variant="outline" size="icon" onClick={copy} aria-label="Copiar link">
                  {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                </Button>
                <a href={url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "icon" })} aria-label="Abrir o link do cliente em nova aba">
                  <ExternalLink aria-hidden="true" />
                </a>
              </div>
              <FormField label="Mensagem do WhatsApp" hint="Vem do modelo. Ajuste se quiser antes de abrir o WhatsApp.">
                <Textarea rows={4} maxLength={1000} value={finalText} onChange={(e) => setText(e.target.value)} />
              </FormField>
              {wa ? (
                <a href={wa} target="_blank" rel="noopener noreferrer" className={buttonVariants({ className: "justify-self-start" })}>
                  <MessageCircle aria-hidden="true" /> Abrir no WhatsApp
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">Sem WhatsApp do contato: edite a proposta e informe o número, ou copie o link.</p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
