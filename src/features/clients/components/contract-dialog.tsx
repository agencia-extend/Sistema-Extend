"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { saveContract } from "@/features/clients/actions";
import { contractSchema } from "@/features/clients/schemas";
import { parseBRL } from "@/domain/shared/money";
import { handleResult } from "@/lib/action-feedback";

export type ContractDraft = { id?: string; startsOn: string; endsOn: string; scopeText: string; fee: string; notes: string };

/** Registrar, renovar ou editar um contrato. O valor só aparece para quem vê valores. */
export function ContractDialog({
  clientId,
  initial,
  title,
  description,
  trigger,
  showValues,
}: {
  clientId: string;
  initial: ContractDraft;
  title: string;
  description: string;
  trigger: ReactNode;
  showValues: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () => {
    setError(null);
    const input = {
      id: v.id,
      clientId,
      startsOn: v.startsOn,
      endsOn: v.endsOn || null,
      scopeText: v.scopeText,
      notes: v.notes,
      ...(showValues ? { feeCents: v.fee.trim() ? parseBRL(v.fee) : null } : {}),
    };
    const parsed = contractSchema.safeParse(input);
    if (!parsed.success) return void setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
    if (showValues && v.fee.trim() && parseBRL(v.fee) === null) return void setErrors({ fee: "Valor inválido. Use o formato 3.500,00." });
    setErrors({});
    start(async () => {
      const res = await saveContract(parsed.data);
      if (!res.ok) return void setError(res.message);
      handleResult(res);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setV(initial); setErrors({}); setError(null); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormAlert>{error}</FormAlert>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Início" required error={errors.startsOn}>
              <Input type="date" value={v.startsOn} onChange={(e) => setV({ ...v, startsOn: e.target.value })} />
            </FormField>
            <FormField label="Fim" optional error={errors.endsOn} hint="Em branco: sem data de fim.">
              <Input type="date" value={v.endsOn} onChange={(e) => setV({ ...v, endsOn: e.target.value })} />
            </FormField>
          </div>
          <FormField label="Escopo contratado" optional error={errors.scopeText} hint="Ex.: 8 vídeos + 4 designs + 4 edições por mês.">
            <Input autoComplete="off" value={v.scopeText} onChange={(e) => setV({ ...v, scopeText: e.target.value })} />
          </FormField>
          {showValues && (
            <FormField label="Mensalidade (R$)" optional error={errors.fee}>
              <Input inputMode="decimal" autoComplete="off" placeholder="Ex.: 3.500,00…" value={v.fee} onChange={(e) => setV({ ...v, fee: e.target.value })} />
            </FormField>
          )}
          <FormField label="Observações" optional error={errors.notes}>
            <Textarea rows={3} maxLength={2000} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
          </FormField>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {pending ? "Salvando…" : "Salvar contrato"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

