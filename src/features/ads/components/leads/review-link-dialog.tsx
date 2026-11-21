"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Copy, LoaderCircle, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormAlert } from "@/components/app/form-field";
import { createLeadReviewLink, revokeLeadReviewLink } from "@/features/ads/leads/actions";
import { handleResult } from "@/lib/action-feedback";

const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * Link para o cliente avaliar os leads. O endereço só aparece quando é criado (o banco guarda só o hash); perdeu,
 * gera outro, e o anterior para de valer.
 */
export function ReviewLinkDialog({ clientId, clientName, link }: { clientId: string; clientName: string; link: { createdAt: string; lastUsedAt: string | null } | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [alert, setAlert] = useState<string | null>(null);
  const [pending, run] = useTransition();

  const create = () =>
    run(async () => {
      setAlert(null);
      const res = await createLeadReviewLink({ clientId });
      if (!res.ok) return setAlert(res.message);
      setUrl((res.data as { url: string }).url);
      router.refresh();
    });
  const revoke = () =>
    run(async () => {
      const res = await revokeLeadReviewLink({ clientId });
      if (handleResult(res)) { setUrl(null); router.refresh(); }
    });
  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setAlert("Não foi possível copiar. Selecione o endereço e copie à mão.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setUrl(null); setAlert(null); setCopied(false); } }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Share2 aria-hidden="true" /> Link de avaliação</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Link de avaliação de leads</DialogTitle>
          <DialogDescription>
            Mande ao {clientName}: ele abre no celular, sem login, e marca cada lead como bom, médio, ruim ou não atendeu. A equipe de tráfego é avisada
            quando ele avalia.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <FormAlert>{alert}</FormAlert>
          {url ? (
            <div className="grid gap-2">
              <label htmlFor="lead-link" className="text-sm font-medium">Endereço para mandar ao cliente</label>
              <div className="flex gap-2">
                <Input id="lead-link" readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
                <Button type="button" variant="outline" onClick={copy} aria-label="Copiar endereço">{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}</Button>
              </div>
              <p className="text-xs text-muted-foreground" role="status">{copied ? "Copiado." : "Guarde agora: por segurança, o endereço não aparece de novo."}</p>
            </div>
          ) : link ? (
            <p className="text-sm">
              Há um link ativo, criado em {fmt.format(new Date(link.createdAt))}.{" "}
              {link.lastUsedAt ? `O cliente avaliou pela última vez em ${fmt.format(new Date(link.lastUsedAt))}.` : "O cliente ainda não avaliou por ele."}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum link ativo para este cliente.</p>
          )}
        </div>
        <DialogFooter className="gap-2">
          {link && !url && <Button variant="ghost" className="text-danger" onClick={revoke} disabled={pending}>Cancelar link</Button>}
          {!url && (
            <Button onClick={create} disabled={pending}>
              {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {link ? "Gerar novo link" : "Gerar link"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
