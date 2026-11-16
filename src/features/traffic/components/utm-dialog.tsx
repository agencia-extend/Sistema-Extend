"use client";

import { useState, useTransition, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormAlert, FormField } from "@/components/app/form-field";
import { buildUtmUrl, UTM_PLATFORMS, UTM_PLATFORM_LABEL, UTM_PRESETS, type UtmPlatform } from "@/domain/traffic/utm";
import { saveUtmLink } from "@/features/traffic/actions";
import { utmSchema } from "@/features/traffic/schemas";
import { handleResult } from "@/lib/action-feedback";

export type UtmValues = { label: string; platform: UtmPlatform; baseUrl: string; source: string; medium: string; campaign: string; term: string; content: string };

const PLATFORM_HINT: Record<UtmPlatform, string> = {
  meta: "As chaves entre {{ }} são trocadas pela Meta em cada clique: origem (fb, ig), nome da campanha, do conjunto e do anúncio.",
  google: "As chaves entre { } são trocadas pelo Google em cada clique: ID da campanha, palavra-chave e anúncio.",
  outro: "Para links da bio, e-mail, WhatsApp ou QR Code. Ex.: origem instagram, mídia bio, campanha black_friday.",
};

/** Gerar link com UTM: escolhe onde vai ser usado (modelo da Meta, do Google ou à mão), o destino e vê o link final. */
export function UtmDialog({ clientId, trigger, initial }: { clientId: string; trigger: ReactNode; initial?: UtmValues }) {
  const blank: UtmValues = { label: "", platform: "meta", baseUrl: "", ...UTM_PRESETS.meta };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<UtmValues>(initial ?? blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [pending, run] = useTransition();
  const upd = (patch: Partial<UtmValues>) => {
    setV((cur) => ({ ...cur, ...patch }));
    setErrors((cur) => Object.fromEntries(Object.entries(cur).filter(([k]) => !(k in patch))));
  };
  const set = (k: keyof UtmValues) => (e: React.ChangeEvent<HTMLInputElement>) => upd({ [k]: e.target.value });
  const preview = buildUtmUrl(v.baseUrl, v);

  const save = () => {
    setAlert(null);
    const parsed = utmSchema.safeParse({ clientId, ...v });
    if (!parsed.success) {
      const e: Record<string, string> = {};
      for (const i of parsed.error.issues) e[i.path.join(".")] ??= i.message;
      setErrors(e);
      setAlert("Revise os campos destacados.");
      return;
    }
    setErrors({});
    run(async () => {
      const res = await saveUtmLink(parsed.data);
      if (!res.ok) return void setAlert(res.message);
      handleResult(res);
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setV(initial ?? blank); setErrors({}); setAlert(null); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Gerar link com UTM</DialogTitle>
          <DialogDescription>O link fica salvo no cliente para a equipe copiar depois.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormAlert>{alert}</FormAlert>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Nome do link" required error={errors.label}>
              <Input autoComplete="off" maxLength={120} placeholder="Ex.: Campanha clareamento…" value={v.label} onChange={set("label")} />
            </FormField>
            <FormField label="Onde vai ser usado" required error={errors.platform}>
              <Select value={v.platform} onValueChange={(x) => upd({ platform: x as UtmPlatform, ...UTM_PRESETS[x as UtmPlatform] })}>
                <SelectTrigger className="w-full" aria-label="Onde vai ser usado"><SelectValue /></SelectTrigger>
                <SelectContent>{UTM_PLATFORMS.map((p) => <SelectItem key={p} value={p}>{UTM_PLATFORM_LABEL[p]}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
          </div>
          <FormField label="Endereço de destino" required error={errors.baseUrl} hint="A página do site para onde o anúncio ou o link leva.">
            <Input type="url" inputMode="url" autoComplete="off" spellCheck={false} placeholder="https://clinica.com.br/agendar…" value={v.baseUrl} onChange={set("baseUrl")} />
          </FormField>
          <p className="text-sm text-muted-foreground">{PLATFORM_HINT[v.platform]}</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Origem (utm_source)" required error={errors.source}>
              <Input autoComplete="off" spellCheck={false} maxLength={200} value={v.source} onChange={set("source")} />
            </FormField>
            <FormField label="Mídia (utm_medium)" required error={errors.medium}>
              <Input autoComplete="off" spellCheck={false} maxLength={200} value={v.medium} onChange={set("medium")} />
            </FormField>
            <FormField label="Campanha (utm_campaign)" required error={errors.campaign}>
              <Input autoComplete="off" spellCheck={false} maxLength={300} value={v.campaign} onChange={set("campaign")} />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Termo (utm_term)" optional error={errors.term}>
              <Input autoComplete="off" spellCheck={false} maxLength={300} value={v.term} onChange={set("term")} />
            </FormField>
            <FormField label="Conteúdo (utm_content)" optional error={errors.content}>
              <Input autoComplete="off" spellCheck={false} maxLength={300} value={v.content} onChange={set("content")} />
            </FormField>
          </div>
          <div className="grid gap-1 rounded-lg border bg-muted/40 p-3">
            <span className="text-xs font-medium text-muted-foreground">Link final</span>
            <output aria-label="Link final" className="text-sm break-all">{preview ?? "Informe o endereço de destino para ver o link."}</output>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Gerar link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
