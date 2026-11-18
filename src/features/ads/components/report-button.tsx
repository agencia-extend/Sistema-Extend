"use client";

import { useState, useTransition } from "react";
import { Download, FileText, LoaderCircle, Send } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PERIOD_LABEL, type Period } from "@/domain/ads";
import { sendReportNow } from "@/features/ads/actions";
import { previewClientReport, setClientReportTemplate } from "@/features/ads/report-actions";
import { handleResult } from "@/lib/action-feedback";
import { cn } from "@/lib/utils";

type ReportPeriod = Period | "semana";
const PERIODS: [ReportPeriod, string][] = [["semana", "Semana passada (seg. a dom.)"], ...(Object.entries(PERIOD_LABEL) as [Period, string][])];
const DEFAULT = "padrao";
const br = (d: string) => d.split("-").reverse().join("/");

/**
 * Relatório do cliente (RF-REL-02/03/05): escolhe o período e o modelo, vê a prévia com os números reais,
 * baixa o PDF ou envia para o grupo de relatórios do WhatsApp.
 */
export function ReportButton({ clientId, templates, templateId, canChoose, canSend }: {
  clientId: string;
  templates: { id: string; name: string; isDefault: boolean }[];
  templateId: string | null;
  canChoose: boolean;
  canSend: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [p, setP] = useState<ReportPeriod>("semana");
  const [tpl, setTpl] = useState(templateId ?? DEFAULT);
  const [preview, setPreview] = useState<{ loading: boolean; text: string | null; range: { start: string; end: string } | null; error: string | null }>({ loading: true, text: null, range: null, error: null });
  const [pending, run] = useTransition();
  const def = templates.find((t) => t.isDefault);

  const load = async (period: ReportPeriod, template: string) => {
    setPreview((x) => ({ ...x, loading: true, error: null }));
    const res = await previewClientReport({ clientId, period, templateId: template === DEFAULT ? null : template });
    if (!res.ok) return setPreview({ loading: false, text: null, range: null, error: res.message });
    const d = res.data as { text: string | null; range: { start: string; end: string } };
    setPreview({ loading: false, text: d.text, range: d.range, error: null });
  };

  const changePeriod = (value: ReportPeriod) => {
    setP(value);
    void load(value, tpl);
  };

  const choose = (value: string) => {
    setTpl(value);
    void load(p, value);
    run(async () => void handleResult(await setClientReportTemplate({ clientId, templateId: value === DEFAULT ? null : value })));
  };

  const send = () => run(async () => {
    const res = await sendReportNow({ clientId, period: p });
    handleResult(res);
    if (res.ok) setOpen(false);
  });

  const empty = !preview.loading && !preview.error && preview.text === null;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) void load(p, tpl); }}>
      <DialogTrigger asChild>
        <Button size="sm"><FileText aria-hidden="true" /> Relatório</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Relatório de anúncios</DialogTitle>
          <DialogDescription>
            Confira o texto com os números já sincronizados.{canSend ? " Envie para o grupo de relatórios do WhatsApp e encaminhe ao cliente, ou baixe o PDF." : " Baixe o PDF para enviar ao cliente."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="rel-periodo">Período</Label>
            <Select value={p} onValueChange={(x) => changePeriod(x as ReportPeriod)}>
              <SelectTrigger id="rel-periodo" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{PERIODS.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rel-modelo">Modelo do cliente</Label>
            <Select value={tpl} onValueChange={choose} disabled={!canChoose || pending}>
              <SelectTrigger id="rel-modelo" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={DEFAULT}>Padrão da agência{def ? ` (${def.name})` : ""}</SelectItem>
                {templates.filter((t) => !t.isDefault).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {canChoose && <p className="text-xs text-muted-foreground">Vale também para o envio automático de segunda.</p>}
          </div>
        </div>
        <section aria-labelledby="rel-previa" aria-busy={preview.loading} className="grid gap-2">
          <h3 id="rel-previa" className="text-sm font-medium">
            Prévia{preview.range ? ` · ${br(preview.range.start)} a ${br(preview.range.end)}` : ""}
          </h3>
          {preview.error ? (
            <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{preview.error}</p>
          ) : empty ? (
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">Sem gasto no período: não há o que relatar. Escolha outro período.</p>
          ) : (
            <div className={cn("min-h-40 rounded-xl rounded-tl-sm border bg-success-soft/40 p-3 text-sm break-words whitespace-pre-wrap", preview.loading && "opacity-60")} aria-live="polite">
              {preview.text ?? "Carregando os números…"}
            </div>
          )}
        </section>
        <DialogFooter className="gap-2">
          {empty || preview.error ? (
            <Button variant="outline" disabled><Download aria-hidden="true" /> Baixar PDF</Button>
          ) : (
            <a href={`/clientes/${clientId}/anuncios/relatorio?periodo=${p}`} download className={buttonVariants({ variant: "outline" })}>
              <Download aria-hidden="true" /> Baixar PDF
            </a>
          )}
          {canSend && (
            <Button onClick={send} disabled={pending || preview.loading || empty || Boolean(preview.error)}>
              {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />} {pending ? "Enviando…" : "Enviar no WhatsApp"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
