"use client";

import { useState, useTransition, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { CREATIVE_FORMATS, CREATIVE_FORMAT_LABEL, type CreativeFormat } from "@/domain/creatives";
import { REJECTION_OUTCOMES, REJECTION_OUTCOME_LABEL, REJECTION_REASON, REJECTION_REASONS, type RejectionReason } from "@/domain/creatives/rejections";
import { saveRejection } from "@/features/traffic/actions";
import type { LibraryOption } from "@/features/traffic/queries";
import { rejectionSchema } from "@/features/traffic/schemas";
import { handleResult } from "@/lib/action-feedback";

const NONE = "__nenhum";
export type RejectionValues = {
  libraryId: string;
  platform: string;
  rejectedOn: string;
  format: string;
  angle: string;
  reason: string;
  policyText: string;
  adName: string;
  outcome: string;
  lesson: string;
};

/** Registrar ou atualizar uma reprovação da Meta: motivo, o que a plataforma disse e o que evitar da próxima vez. */
export function RejectionDialog({ clientId, today, library, trigger, initial, id }: { clientId: string; today: string; library: LibraryOption[]; trigger: ReactNode; initial?: RejectionValues; id?: string }) {
  const blank: RejectionValues = { libraryId: NONE, platform: "meta", rejectedOn: today, format: "", angle: "", reason: "", policyText: "", adName: "", outcome: NONE, lesson: "" };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<RejectionValues>(initial ?? blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [pending, run] = useTransition();
  // Preencher um campo apaga o erro dele (a dica volta a aparecer).
  const upd = (patch: Partial<RejectionValues>) => {
    setV((cur) => ({ ...cur, ...patch }));
    setErrors((cur) => Object.fromEntries(Object.entries(cur).filter(([k]) => !(k in patch))));
  };
  const set = (k: keyof RejectionValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => upd({ [k]: e.target.value });

  const pickLibrary = (libraryId: string) => {
    const item = library.find((l) => l.id === libraryId);
    upd({ libraryId, ...(item ? { format: item.format, angle: item.angle } : {}) });
  };

  const save = () => {
    setAlert(null);
    const parsed = rejectionSchema.safeParse({
      id,
      clientId,
      libraryId: v.libraryId === NONE ? null : v.libraryId,
      platform: v.platform,
      rejectedOn: v.rejectedOn,
      format: v.format || undefined,
      angle: v.angle,
      reason: v.reason || undefined,
      policyText: v.policyText,
      adName: v.adName,
      outcome: v.outcome === NONE ? null : v.outcome,
      lesson: v.lesson,
    });
    if (!parsed.success) {
      const e: Record<string, string> = {};
      for (const i of parsed.error.issues) e[i.path.join(".")] ??= i.message;
      setErrors(e);
      setAlert("Revise os campos destacados.");
      return;
    }
    setErrors({});
    run(async () => {
      const res = await saveRejection(parsed.data);
      if (!res.ok) return void setAlert(res.message);
      handleResult(res);
      setOpen(false);
    });
  };

  const reasonHint = v.reason ? REJECTION_REASON[v.reason as RejectionReason]?.hint : "Escolha o que mais se aproxima do motivo que a Meta deu.";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setV(initial ?? blank); setErrors({}); setAlert(null); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{id ? "Atualizar reprovação" : "Registrar reprovação"}</DialogTitle>
          <DialogDescription>Quem pede e quem produz criativos para este cliente vê o motivo antes do próximo pedido.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormAlert>{alert}</FormAlert>
          {library.length > 0 && (
            <FormField label="Criativo da biblioteca" optional hint="A peça fica marcada como “Reprovado pela Meta”.">
              <Select value={v.libraryId} onValueChange={pickLibrary}>
                <SelectTrigger className="w-full" aria-label="Criativo da biblioteca"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Não está na biblioteca</SelectItem>
                  {library.map((l) => <SelectItem key={l.id} value={l.id}>{l.angle} ({CREATIVE_FORMAT_LABEL[l.format as CreativeFormat] ?? l.format} · {l.campaign})</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Data" required error={errors.rejectedOn}>
              <Input type="date" max={today} value={v.rejectedOn} onChange={set("rejectedOn")} />
            </FormField>
            <FormField label="Plataforma" required error={errors.platform}>
              <Select value={v.platform} onValueChange={(x) => upd({ platform: x })}>
                <SelectTrigger className="w-full" aria-label="Plataforma"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="meta">Meta</SelectItem><SelectItem value="google">Google Ads</SelectItem></SelectContent>
              </Select>
            </FormField>
            <FormField label="Formato" required error={errors.format}>
              <Select value={v.format} onValueChange={(x) => upd({ format: x })}>
                <SelectTrigger className="w-full" aria-label="Formato"><SelectValue placeholder="Escolha…" /></SelectTrigger>
                <SelectContent>{CREATIVE_FORMATS.map((f) => <SelectItem key={f} value={f}>{CREATIVE_FORMAT_LABEL[f]}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
          </div>
          <FormField label="Ângulo / mensagem do anúncio" required error={errors.angle}>
            <Input autoComplete="off" maxLength={300} placeholder="Ex.: Antes e depois do clareamento…" value={v.angle} onChange={set("angle")} />
          </FormField>
          <FormField label="Motivo" required error={errors.reason} hint={reasonHint}>
            <Select value={v.reason} onValueChange={(x) => upd({ reason: x })}>
              <SelectTrigger className="w-full" aria-label="Motivo"><SelectValue placeholder="Escolha…" /></SelectTrigger>
              <SelectContent>{REJECTION_REASONS.map((r) => <SelectItem key={r} value={r}>{REJECTION_REASON[r].label}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <FormField label="O que a Meta disse" required error={errors.policyText}>
            <Textarea rows={3} maxLength={1000} placeholder="Cole a mensagem da reprovação ou resuma a política citada…" value={v.policyText} onChange={set("policyText")} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Nome do anúncio" optional error={errors.adName}>
              <Input autoComplete="off" maxLength={200} placeholder="Como está no Gerenciador…" value={v.adName} onChange={set("adName")} />
            </FormField>
            <FormField label="Desfecho" optional>
              <Select value={v.outcome} onValueChange={(x) => upd({ outcome: x })}>
                <SelectTrigger className="w-full" aria-label="Desfecho"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Em aberto</SelectItem>
                  {REJECTION_OUTCOMES.map((o) => <SelectItem key={o} value={o}>{REJECTION_OUTCOME_LABEL[o]}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <FormField label="O que evitar da próxima vez" optional error={errors.lesson} hint="Aparece no pedido de criativo deste cliente.">
            <Textarea rows={2} maxLength={500} placeholder="Ex.: Mostrar só o resultado, sem comparação lado a lado…" value={v.lesson} onChange={set("lesson")} />
          </FormField>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {id ? "Salvar" : "Registrar reprovação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
