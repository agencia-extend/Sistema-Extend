"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { TRAINING_CATEGORIES, TRAINING_CATEGORY_LABEL } from "@/domain/trainings";
import { saveTraining } from "@/features/trainings/actions";
import type { TrainingInput } from "@/features/trainings/schemas";
import { handleResult } from "@/lib/action-feedback";

const BLANK: TrainingInput = { title: "", summary: "", category: "processos", isPublished: false };

/** Criar ou editar um treinamento (nome, resumo, área e publicação). */
export function TrainingDialog({ training, trigger }: { training?: TrainingInput; trigger: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<TrainingInput>(training ?? BLANK);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setError(null);
      setErrors({});
      const res = await saveTraining(v);
      if (!res.ok) {
        setError(res.message);
        setErrors(res.fieldErrors ?? {});
        return;
      }
      handleResult(res);
      setOpen(false);
      if (!training?.id && res.data) router.push(`/treinamentos/${res.data.id}`);
      else router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setV(training ?? BLANK); setError(null); setErrors({}); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{training?.id ? "Editar treinamento" : "Novo treinamento"}</DialogTitle>
          <DialogDescription>Um treinamento é uma sequência de aulas. Enquanto estiver em rascunho, só quem gerencia treinamentos vê.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormAlert>{error}</FormAlert>
          <FormField label="Nome" required error={errors.title?.[0]}>
            <Input autoComplete="off" placeholder="Ex.: Como montar o cronograma do mês…" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
          </FormField>
          <FormField label="Área">
            <Select value={v.category} onValueChange={(c) => setV({ ...v, category: c as TrainingInput["category"] })}>
              <SelectTrigger className="w-full" aria-label="Área"><SelectValue /></SelectTrigger>
              <SelectContent>{TRAINING_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{TRAINING_CATEGORY_LABEL[c]}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <FormField label="Para que serve" optional error={errors.summary?.[0]} hint="Uma ou duas frases. Aparece na lista.">
            <Textarea rows={3} value={v.summary ?? ""} onChange={(e) => setV({ ...v, summary: e.target.value })} />
          </FormField>
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <Switch id="training-published" checked={v.isPublished} onCheckedChange={(c) => setV({ ...v, isPublished: c })} />
            <label htmlFor="training-published" className="grid gap-0.5 text-sm">
              <span className="font-medium">Publicado</span>
              <span className="text-muted-foreground">A equipe vê e quem já foi atribuído recebe o aviso.</span>
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending || v.title.trim().length < 2}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {training?.id ? "Salvar treinamento" : "Criar treinamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
