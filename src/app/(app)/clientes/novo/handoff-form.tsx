"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/app/form-field";
import { createHandoff, uploadClientFile } from "@/features/clients/actions";
import { handoffSchema } from "@/features/clients/schemas";
import { UNIT_LABEL } from "@/domain/clients";
import { parseBRL } from "@/domain/shared/money";

type Svc = { id: string; name: string; unit: string };
type Values = {
  name: string;
  legal_name: string;
  document: string;
  segment: string;
  contact: { name: string; phone: string; email: string; role: string };
  picked: Record<string, { on: boolean; qty: string; price: string }>;
  monthly_fee: string;
  setup_fee: string;
  media_budget: string;
  payment_method: string;
  contract_start: string;
  contract_months: string;
  communication_channel: string;
  notes: string;
  promises: { description: string; due_at: string }[];
};

const today = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

export function HandoffForm({ services }: { services: Svc[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Values>({
    defaultValues: {
      name: "",
      legal_name: "",
      document: "",
      segment: "",
      contact: { name: "", phone: "", email: "", role: "" },
      picked: Object.fromEntries(services.map((s) => [s.id, { on: false, qty: "", price: "" }])),
      monthly_fee: "",
      setup_fee: "",
      media_budget: "",
      payment_method: "",
      contract_start: today(),
      contract_months: "12",
      communication_channel: "",
      notes: "",
      promises: [],
    },
  });
  const promises = useFieldArray({ control: form.control, name: "promises" });
  const picked = useWatch({ control: form.control, name: "picked" });

  const onSubmit = form.handleSubmit((v) => {
    setError(null);
    const payload = {
      ...v,
      services: services
        .filter((s) => v.picked[s.id]?.on)
        .map((s) => ({ service_id: s.id, monthly_qty: Number(v.picked[s.id].qty) || 0, price_cents: parseBRL(v.picked[s.id].price) })),
      monthly_fee_cents: parseBRL(v.monthly_fee),
      setup_fee_cents: parseBRL(v.setup_fee),
      media_budget_cents: parseBRL(v.media_budget),
      contract_months: v.contract_months ? Number(v.contract_months) : null,
      promises: v.promises.map((p) => ({ description: p.description, due_at: p.due_at ? new Date(p.due_at).toISOString() : "" })),
    };
    const parsed = handoffSchema.safeParse(payload);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      setError(first?.message ?? "Revise os campos.");
      return;
    }
    startTransition(async () => {
      const res = await createHandoff(parsed.data);
      if (!res.ok) return setError(res.message);
      const id = (res.data as { id: string }).id;
      let failed = 0;
      for (const f of files) {
        const fd = new FormData();
        fd.set("clientId", id);
        fd.set("category", "fechamento");
        fd.set("file", f);
        const up = await uploadClientFile(fd);
        if (!up.ok) failed++;
      }
      toast.success(res.message ?? "Fechamento registrado.");
      if (failed) toast.error(`${failed} anexo(s) não foram enviados. Envie de novo na aba Arquivos.`);
      router.push(`/clientes/${id}`);
    });
  });

  const reg = form.register;
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-8">
      <FormAlert>{error}</FormAlert>

      <fieldset className="grid gap-4">
        <legend className="mb-1 text-base font-semibold">Cliente</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Nome do cliente" required error={form.formState.errors.name?.message}>
            <Input autoComplete="off" {...reg("name", { required: "Informe o nome do cliente." })} />
          </FormField>
          <FormField label="Nicho / segmento" optional>
            <Input placeholder="Ex.: Imobiliário…" autoComplete="off" {...reg("segment")} />
          </FormField>
          <FormField label="Razão social" optional>
            <Input autoComplete="off" {...reg("legal_name")} />
          </FormField>
          <FormField label="CNPJ ou CPF" optional>
            <Input inputMode="numeric" autoComplete="off" {...reg("document")} />
          </FormField>
        </div>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-1 text-base font-semibold">Contato principal</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Nome" optional>
            <Input autoComplete="off" {...reg("contact.name")} />
          </FormField>
          <FormField label="Cargo" optional>
            <Input placeholder="Ex.: Proprietário…" autoComplete="off" {...reg("contact.role")} />
          </FormField>
          <FormField label="WhatsApp" optional>
            <Input type="tel" inputMode="tel" autoComplete="off" {...reg("contact.phone")} />
          </FormField>
          <FormField label="E-mail" optional>
            <Input type="email" inputMode="email" autoComplete="off" spellCheck={false} {...reg("contact.email")} />
          </FormField>
        </div>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="mb-1 text-base font-semibold">Serviços vendidos</legend>
        <p className="text-sm text-muted-foreground">A quantidade por mês define as demandas que o sistema cria todo mês depois do onboarding.</p>
        <ul className="divide-y rounded-xl border bg-card">
          {services.map((s) => {
            const on = picked[s.id]?.on;
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="flex min-h-10 flex-1 basis-56 items-center gap-2">
                  <Checkbox
                    id={`svc-${s.id}`}
                    checked={on}
                    onCheckedChange={(v) => form.setValue(`picked.${s.id}.on`, v === true, { shouldDirty: true })}
                  />
                  <Label htmlFor={`svc-${s.id}`} className="font-normal">
                    {s.name}
                  </Label>
                </div>
                {on && (
                  <div className="flex flex-wrap gap-2">
                    {s.unit !== "nenhuma" && (
                      <Input
                        type="number"
                        min={0}
                        max={200}
                        inputMode="numeric"
                        className="w-32"
                        aria-label={`Quantidade de ${s.name}`}
                        placeholder={`${UNIT_LABEL[s.unit]}…`}
                        {...reg(`picked.${s.id}.qty`)}
                      />
                    )}
                    <Input inputMode="decimal" className="w-36" aria-label={`Valor de ${s.name}`} placeholder="R$ por mês…" {...reg(`picked.${s.id}.price`)} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-1 text-base font-semibold">Contrato e valores</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Início do contrato" required>
            <Input type="date" {...reg("contract_start")} />
          </FormField>
          <FormField label="Duração (meses)" optional>
            <Input type="number" min={1} max={120} inputMode="numeric" {...reg("contract_months")} />
          </FormField>
          <FormField label="Forma de pagamento" optional>
            <Input placeholder="Ex.: Boleto dia 10…" autoComplete="off" {...reg("payment_method")} />
          </FormField>
          <FormField label="Mensalidade (R$)" optional>
            <Input inputMode="decimal" placeholder="0,00…" {...reg("monthly_fee")} />
          </FormField>
          <FormField label="Taxa de implantação (R$)" optional>
            <Input inputMode="decimal" placeholder="0,00…" {...reg("setup_fee")} />
          </FormField>
          <FormField label="Verba de mídia/mês (R$)" optional>
            <Input inputMode="decimal" placeholder="0,00…" {...reg("media_budget")} />
          </FormField>
        </div>
        <FormField label="Grupo de WhatsApp ou canal com o cliente" optional>
          <Input type="url" placeholder="https://chat.whatsapp.com/…" autoComplete="off" {...reg("communication_channel")} />
        </FormField>
        <FormField label="Observações e condições especiais" optional>
          <Textarea rows={4} {...reg("notes")} />
        </FormField>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="mb-1 text-base font-semibold">Promessas comerciais</legend>
        <p className="text-sm text-muted-foreground">O que foi combinado com prazo (ex.: “primeiro vídeo em 7 dias”). O sistema avisa antes de vencer.</p>
        {promises.fields.map((f, i) => (
          <div key={f.id} className="flex flex-wrap items-end gap-2">
            <FormField label="Promessa" className="min-w-0 flex-1 basis-60">
              <Input autoComplete="off" {...reg(`promises.${i}.description`)} />
            </FormField>
            <FormField label="Prazo">
              <Input type="datetime-local" {...reg(`promises.${i}.due_at`)} />
            </FormField>
            <Button type="button" variant="ghost" size="icon" className="size-10" aria-label="Remover promessa" onClick={() => promises.remove(i)}>
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" className="justify-self-start" onClick={() => promises.append({ description: "", due_at: "" })}>
          <Plus aria-hidden="true" /> Adicionar promessa
        </Button>
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-base font-semibold">Anexos da negociação</legend>
        <FormField label="Prints, contrato ou proposta" hint="Até 10 MB por arquivo. Vídeos ficam no Drive." optional>
          <Input type="file" multiple accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
        </FormField>
      </fieldset>

      <div className="flex gap-2">
        <Button type="submit" size="lg" disabled={pending}>
          {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          {pending ? "Registrando…" : "Registrar fechamento"}
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={() => router.back()} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
