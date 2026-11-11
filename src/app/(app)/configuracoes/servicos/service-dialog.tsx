"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, Plus } from "lucide-react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FormField } from "@/components/app/form-field";
import { saveCatalogService } from "@/features/clients/settings-actions";
import type { serviceCatalogSchema } from "@/features/clients/schemas";
import { handleResult } from "@/lib/action-feedback";

type Svc = z.input<typeof serviceCatalogSchema>;
const NONE = "__nenhum";

export const TAB_LABEL: Record<string, string> = {
  anuncios: "Anúncios",
  videos: "Vídeos",
  design: "Design",
  conteudo: "Conteúdo",
  gerenciamento: "Gerenciamento",
  gravacao: "Gravação",
  site: "Site",
};
const TYPES: Record<string, string> = { video: "Vídeo", design: "Arte", conteudo: "Post", gravacao: "Gravação", site: "Site", criativo: "Criativo" };
const UNITS: Record<string, string> = { videos: "Vídeos por mês", artes: "Artes por mês", posts: "Posts por mês", gravacoes: "Gravações por mês", nenhuma: "Sem quantidade mensal" };

export function ServiceDialog({ sectors, service }: { sectors: { id: string; name: string }[]; service?: Svc }) {
  const blank: Svc = { name: "", sector_id: null, unit: "nenhuma", task_type: null, tabs: [], is_active: true };
  const [open, setOpen] = useState(false);
  const [s, setS] = useState<Svc>(service ?? blank);
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
      <DialogTrigger asChild>
        {service ? <Button variant="outline" size="sm">Editar</Button> : <Button><Plus aria-hidden="true" /> Novo serviço</Button>}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{service ? "Editar serviço" : "Novo serviço"}</DialogTitle>
          <DialogDescription>Mudanças valem para os próximos meses. Desativar esconde o serviço de novos fechamentos.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField label="Nome" required><Input autoComplete="off" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} /></FormField>
          <FormField label="Setor responsável" hint="Quem recebe as demandas geradas.">
            <Select value={s.sector_id ?? NONE} onValueChange={(v) => setS({ ...s, sector_id: v === NONE ? null : v })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem setor</SelectItem>
                {sectors.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Unidade mensal">
              <Select value={s.unit} onValueChange={(v) => setS({ ...s, unit: v as Svc["unit"] })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(UNITS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            <FormField label="Tipo de demanda gerada">
              <Select value={s.task_type ?? NONE} onValueChange={(v) => setS({ ...s, task_type: v === NONE ? null : (v as Svc["task_type"]) })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Não gera demandas</SelectItem>
                  {Object.entries(TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <fieldset className="grid gap-1">
            <legend className="mb-1 text-sm font-medium">Abas que libera no cliente</legend>
            <div className="grid grid-cols-2 gap-1">
              {Object.entries(TAB_LABEL).map(([k, v]) => (
                <div key={k} className="flex min-h-9 items-center gap-2">
                  <Checkbox
                    id={`tab-${service?.id ?? "n"}-${k}`}
                    checked={s.tabs?.includes(k as never)}
                    onCheckedChange={(on) => setS({ ...s, tabs: on ? [...(s.tabs ?? []), k as never] : (s.tabs ?? []).filter((t) => t !== k) })}
                  />
                  <Label htmlFor={`tab-${service?.id ?? "n"}-${k}`} className="font-normal">{v}</Label>
                </div>
              ))}
            </div>
          </fieldset>
          <div className="flex min-h-10 items-center gap-3">
            <Switch id={`ativo-${service?.id ?? "n"}`} checked={s.is_active} onCheckedChange={(v) => setS({ ...s, is_active: v })} />
            <Label htmlFor={`ativo-${service?.id ?? "n"}`} className="font-normal">Serviço ativo</Label>
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={pending || s.name.trim().length < 2}
            onClick={() => startTransition(async () => { if (handleResult(await saveCatalogService({ ...s, tabs: s.tabs ?? [] }))) { setOpen(false); if (!service) setS(blank); } })}
          >
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Salvar serviço
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
