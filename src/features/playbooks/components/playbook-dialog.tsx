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
import { PLAYBOOK_AREAS, PLAYBOOK_AREA_LABEL, type PlaybookArea } from "@/domain/playbooks";
import { savePlaybook } from "@/features/playbooks/actions";
import { playbookSchema, type PlaybookInput } from "@/features/playbooks/schemas";
import { handleResult } from "@/lib/action-feedback";

const BLANK: PlaybookInput = { name: "", area: "geral", description: "", isActive: true };

/** Criar ou editar um playbook (nome, área, para que serve e se está ativo). */
export function PlaybookDialog({ playbook, trigger }: { playbook?: PlaybookInput; trigger: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<PlaybookInput>(playbook ?? BLANK);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () => {
    const parsed = playbookSchema.safeParse(v);
    if (!parsed.success) return void setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
    setErrors({});
    start(async () => {
      const res = await savePlaybook(parsed.data);
      if (!res.ok) return void setError(res.message);
      handleResult(res);
      setOpen(false);
      if (!playbook?.id && res.data) router.push(`/playbooks/${(res.data as { id: string }).id}`);
      else router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setV(playbook ?? BLANK); setErrors({}); setError(null); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{playbook?.id ? "Editar playbook" : "Novo playbook"}</DialogTitle>
          <DialogDescription>Um processo padrão da agência. Aplicado a um cliente, cria as demandas e os marcos com as datas certas.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormAlert>{error}</FormAlert>
          <FormField label="Nome" required error={errors.name}>
            <Input autoComplete="off" placeholder="Ex.: Lançamento de campanha…" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          </FormField>
          <FormField label="Área">
            <Select value={v.area} onValueChange={(a) => setV({ ...v, area: a as PlaybookArea })}>
              <SelectTrigger className="w-full" aria-label="Área"><SelectValue /></SelectTrigger>
              <SelectContent>{PLAYBOOK_AREAS.map((a) => <SelectItem key={a} value={a}>{PLAYBOOK_AREA_LABEL[a]}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <FormField label="Para que serve" optional error={errors.description}>
            <Textarea rows={3} maxLength={1000} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
          </FormField>
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <Switch id="pb-ativo" checked={v.isActive} onCheckedChange={(c) => setV({ ...v, isActive: c })} />
            <label htmlFor="pb-ativo" className="grid gap-0.5 text-sm">
              <span className="font-medium">Ativo</span>
              <span className="text-muted-foreground">Arquivado não pode ser aplicado, mas continua nos clientes onde já foi.</span>
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} {pending ? "Salvando…" : playbook?.id ? "Salvar playbook" : "Criar playbook"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
