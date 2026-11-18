"use client";

import { useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { DEFAULT_REPORT_TEMPLATE, REPORT_VARIABLES, renderReport, reportValues, sampleReportData } from "@/domain/ads/report";
import { deleteReportTemplate, saveReportTemplate } from "@/features/ads/report-actions";
import { reportTemplateSchema } from "@/features/ads/schemas";
import type { ReportTemplate } from "@/features/ads/report-queries";
import { handleResult } from "@/lib/action-feedback";

const SAMPLE = reportValues(sampleReportData());

/** Criar ou editar um modelo de relatório (RF-REL-02): texto com variáveis e prévia com números de exemplo. */
export function TemplateEditor({ template, trigger }: { template: ReportTemplate | null; trigger: ReactNode }) {
  const initial = () => ({ name: template?.name ?? "", body: template?.body ?? DEFAULT_REPORT_TEMPLATE, isDefault: template?.isDefault ?? false });
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [pending, run] = useTransition();
  const area = useRef<HTMLTextAreaElement>(null);
  const preview = useMemo(() => renderReport(v.body, SAMPLE), [v.body]);

  const insert = (key: string) => {
    const el = area.current;
    const token = `{${key}}`;
    const start = el?.selectionStart ?? v.body.length;
    const end = el?.selectionEnd ?? v.body.length;
    const body = v.body.slice(0, start) + token + v.body.slice(end);
    setV((c) => ({ ...c, body }));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);
    const input = { id: template?.id, ...v };
    const parsed = reportTemplateSchema.safeParse(input);
    if (!parsed.success) {
      const out: Record<string, string> = {};
      for (const i of parsed.error.issues) out[String(i.path[0])] ??= i.message;
      setErrors(out);
      return setAlert("Revise os campos destacados.");
    }
    setErrors({});
    run(async () => {
      const res = await saveReportTemplate(input);
      if (!res.ok) return void setAlert(res.message);
      handleResult(res);
      setOpen(false);
    });
  };

  const remove = () =>
    run(async () => {
      const res = await deleteReportTemplate({ id: template!.id });
      if (!res.ok) return void setAlert(res.message);
      handleResult(res);
      setOpen(false);
    });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setV(initial()); setErrors({}); setAlert(null); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{template ? `Editar ${template.name}` : "Novo modelo de relatório"}</DialogTitle>
          <DialogDescription>Escreva o texto como vai no WhatsApp (*negrito*, emojis). As variáveis viram os números do cliente no envio. Linha com variável sem valor some, como o saldo de conta pós-paga.</DialogDescription>
        </DialogHeader>
        <form id="template-form" onSubmit={save} noValidate className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div className="grid content-start gap-4">
            <FormAlert>{alert}</FormAlert>
            <FormField label="Nome do modelo" required error={errors.name}>
              <Input autoComplete="off" maxLength={80} placeholder="Ex.: Semanal com leads…" value={v.name} onChange={(e) => setV((c) => ({ ...c, name: e.target.value }))} />
            </FormField>
            <FormField label="Texto do relatório" required error={errors.body}>
              <Textarea ref={area} rows={14} maxLength={4000} spellCheck={false} className="font-mono text-sm" value={v.body} onChange={(e) => setV((c) => ({ ...c, body: e.target.value }))} />
            </FormField>
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">Inserir variável <span className="font-normal text-muted-foreground">(entra onde está o cursor)</span></legend>
              <div className="flex flex-wrap gap-1.5">
                {REPORT_VARIABLES.map((x) => (
                  <Button key={x.key} type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" title={x.label} aria-label={`Inserir ${x.label}`} onClick={() => insert(x.key)}>
                    {`{${x.key}}`}
                  </Button>
                ))}
              </div>
            </fieldset>
            <div className="flex items-center gap-2">
              <Checkbox id="tpl-default" checked={v.isDefault} disabled={template?.isDefault} onCheckedChange={(c) => setV((x) => ({ ...x, isDefault: c === true }))} />
              <Label htmlFor="tpl-default" className="text-sm font-normal">
                {template?.isDefault ? "Este é o modelo padrão da agência" : "Usar como padrão da agência (clientes sem modelo próprio)"}
              </Label>
            </div>
          </div>
          <section aria-labelledby="tpl-preview" className="grid content-start gap-2">
            <h3 id="tpl-preview" className="text-sm font-medium">Prévia com números de exemplo</h3>
            <div aria-live="polite" className="rounded-xl rounded-tl-sm border bg-success-soft/40 p-3 text-sm break-words whitespace-pre-wrap">
              {preview || <span className="text-muted-foreground">O texto aparece aqui.</span>}
            </div>
          </section>
        </form>
        <DialogFooter className="gap-2 sm:justify-between">
          {template && !template.isDefault ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="ghost" className="text-danger" disabled={pending}><Trash2 aria-hidden="true" /> Excluir modelo</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir {template.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {template.clients ? `${template.clients} ${template.clients === 1 ? "cliente usa" : "clientes usam"} este modelo e ${template.clients === 1 ? "passa" : "passam"} a usar o padrão da agência.` : "Nenhum cliente usa este modelo."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Manter</AlertDialogCancel>
                  <AlertDialogAction onClick={remove}>Excluir</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : <span />}
          <Button type="submit" form="template-form" disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {template ? "Salvar modelo" : "Criar modelo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
