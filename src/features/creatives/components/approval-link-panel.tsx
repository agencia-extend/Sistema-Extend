"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, Link2, LoaderCircle, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createApprovalLink } from "@/features/creatives/actions";
import { whatsappApprovalLink } from "@/domain/creatives";
import { handleResult } from "@/lib/action-feedback";

/** Gerar o link do cliente e enviar (copiar ou abrir o WhatsApp com a mensagem pronta). */
export function ApprovalLinkPanel({ taskId, clientName, title }: { taskId: string; clientName: string; title: string }) {
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const create = () =>
    start(async () => {
      const res = await createApprovalLink({ taskId });
      if (!handleResult(res) || !res.ok) return;
      setUrl(res.data.url);
      router.refresh();
    });
  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o link e copie.");
    }
  };
  return (
    <div className="grid gap-2">
      {!url ? (
        <Button onClick={create} disabled={pending} className="w-fit">
          {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Link2 aria-hidden="true" />} Gerar link para o cliente
        </Button>
      ) : (
        <>
          <Input readOnly value={url} aria-label="Link para o cliente aprovar" onFocus={(e) => e.currentTarget.select()} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={copy}><Copy aria-hidden="true" /> Copiar link</Button>
            <Button asChild variant="outline">
              <a href={whatsappApprovalLink(url, clientName, title)} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" /> Enviar no WhatsApp</a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">O link vale 7 dias e aceita uma decisão. Gerar outro invalida este.</p>
        </>
      )}
    </div>
  );
}
