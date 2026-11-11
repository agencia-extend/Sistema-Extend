"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { LoaderCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/app/form-field";
import { updateClientData } from "@/features/clients/actions";
import { handleResult } from "@/lib/action-feedback";
import { centsToInput, formatBRL, parseBRL } from "@/domain/shared/money";
import { formatDate } from "@/domain/shared/dates";
import { Section } from "./section";

type Data = {
  id: string;
  name: string;
  legal_name: string;
  document: string;
  segment: string;
  contract_start: string;
  contract_end: string;
  renewal_date: string;
  media_budget_cents: number | null;
  monthly_fee_cents: number | null;
  payment_method: string;
  communication_channel: string;
  notes: string;
};

export function DataCard({ client, canManage, showValues }: { client: Data; canManage: boolean; showValues: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm({
    defaultValues: { ...client, media_budget: centsToInput(client.media_budget_cents), monthly_fee: centsToInput(client.monthly_fee_cents) },
  });
  const submit = form.handleSubmit((v) =>
    startTransition(async () => {
      const { media_budget, monthly_fee, ...rest } = v;
      const res = await updateClientData({ ...rest, media_budget_cents: parseBRL(media_budget), monthly_fee_cents: parseBRL(monthly_fee) });
      if (handleResult(res, form)) setOpen(false);
    }),
  );
  const d = (v: string) => (v ? formatDate(`${v}T12:00:00Z`) : "—");
  const rows: [string, React.ReactNode][] = [
    ["Razão social", client.legal_name || "—"],
    ["CNPJ/CPF", client.document || "—"],
    ["Contrato", client.contract_start ? `${d(client.contract_start)} a ${d(client.contract_end)}` : "—"],
    ["Renovação", d(client.renewal_date)],
    ...(showValues
      ? ([
          ["Mensalidade", formatBRL(client.monthly_fee_cents)],
          ["Verba de mídia/mês", formatBRL(client.media_budget_cents)],
          ["Pagamento", client.payment_method || "—"],
        ] as [string, React.ReactNode][])
      : []),
    [
      "Canal com o cliente",
      client.communication_channel ? (
        /^https?:\/\//.test(client.communication_channel) ? (
          <a href={client.communication_channel} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            Abrir
          </a>
        ) : (
          client.communication_channel
        )
      ) : (
        "—"
      ),
    ],
  ];
  return (
    <Section
      title="Dados do cliente"
      action={
        canManage ? (
          <Dialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Pencil aria-hidden="true" /> Editar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Dados do cliente</DialogTitle>
                <DialogDescription>Cadastro central usado por todos os setores.</DialogDescription>
              </DialogHeader>
              <form id="client-data" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
                <FormField label="Nome" required error={form.formState.errors.name?.message}>
                  <Input autoComplete="off" {...form.register("name")} />
                </FormField>
                <FormField label="Nicho / segmento" optional>
                  <Input autoComplete="off" {...form.register("segment")} />
                </FormField>
                <FormField label="Razão social" optional>
                  <Input autoComplete="off" {...form.register("legal_name")} />
                </FormField>
                <FormField label="CNPJ/CPF" optional>
                  <Input autoComplete="off" {...form.register("document")} />
                </FormField>
                <FormField label="Início do contrato" optional>
                  <Input type="date" {...form.register("contract_start")} />
                </FormField>
                <FormField label="Fim do contrato" optional>
                  <Input type="date" {...form.register("contract_end")} />
                </FormField>
                <FormField label="Data de renovação" optional>
                  <Input type="date" {...form.register("renewal_date")} />
                </FormField>
                {showValues && (
                  <>
                    <FormField label="Forma de pagamento" optional>
                      <Input autoComplete="off" {...form.register("payment_method")} />
                    </FormField>
                    <FormField label="Mensalidade (R$)" optional>
                      <Input inputMode="decimal" {...form.register("monthly_fee")} />
                    </FormField>
                    <FormField label="Verba de mídia/mês (R$)" optional>
                      <Input inputMode="decimal" {...form.register("media_budget")} />
                    </FormField>
                  </>
                )}
                <FormField label="Canal com o cliente (link do grupo)" optional className="sm:col-span-2">
                  <Input autoComplete="off" {...form.register("communication_channel")} />
                </FormField>
                <FormField label="Observações" optional className="sm:col-span-2">
                  <Textarea rows={3} {...form.register("notes")} />
                </FormField>
              </form>
              <DialogFooter>
                <Button type="submit" form="client-data" disabled={pending}>
                  {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
                  Salvar dados
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : undefined
      }
    >
      <dl className="grid gap-1.5 rounded-xl border bg-card p-4 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="min-w-0 truncate text-right">{v}</dd>
          </div>
        ))}
        {client.notes && <p className="mt-2 border-t pt-2 whitespace-pre-line text-muted-foreground">{client.notes}</p>}
      </dl>
    </Section>
  );
}
