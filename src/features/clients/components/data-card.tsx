"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { LoaderCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/app/form-field";
import { updateClientData } from "@/features/clients/actions";
import { clientDataSchema } from "@/features/clients/schemas";
import { handleResult } from "@/lib/action-feedback";
import { centsToInput, formatBRL, parseBRL } from "@/domain/shared/money";
import { clientCode } from "@/domain/clients";
import { dayLabel } from "@/domain/trainings";
import { Section } from "./section";

type Data = {
  id: string;
  code: number;
  name: string;
  owner_id: string | null;
  owner_name: string | null;
  scope_text: string;
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

const NONE = "__ninguem";

/** Cadastro central do cliente. Datas, escopo e valor do contrato ficam na aba Contratos. */
export function DataCard({ client, canManage, showValues, team }: { client: Data; canManage: boolean; showValues: boolean; team: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm({
    defaultValues: {
      id: client.id,
      name: client.name,
      code: String(client.code),
      owner_id: client.owner_id ?? NONE,
      legal_name: client.legal_name,
      document: client.document,
      segment: client.segment,
      payment_method: client.payment_method,
      communication_channel: client.communication_channel,
      notes: client.notes,
      media_budget: centsToInput(client.media_budget_cents),
    },
  });
  const submit = form.handleSubmit((v) =>
    startTransition(async () => {
      const { media_budget, code, owner_id, ...rest } = v;
      const input = { ...rest, code: Number(code), owner_id: owner_id === NONE ? null : owner_id, media_budget_cents: parseBRL(media_budget) };
      const parsed = clientDataSchema.safeParse(input);
      if (!parsed.success) {
        for (const i of parsed.error.issues) form.setError(String(i.path[0]) as never, { message: i.message });
        return;
      }
      if (handleResult(await updateClientData(parsed.data), form)) setOpen(false);
    }),
  );
  const contract = client.contract_end ? `até ${dayLabel(client.contract_end)}` : client.contract_start ? "sem data de fim" : "—";
  const rows: [string, React.ReactNode][] = [
    ["Nº", clientCode(client.code)],
    ["Responsável pela comunicação", client.owner_name ?? "Ninguém definido"],
    ["Escopo contratado", client.scope_text || "—"],
    ["Razão social", client.legal_name || "—"],
    ["CNPJ/CPF", client.document || "—"],
    ["Contrato atual", <Link key="c" href={`/clientes/${client.id}/contratos`} className="text-primary hover:underline">{contract}</Link>],
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
          <a href={client.communication_channel} target="_blank" rel="noreferrer" className="text-primary hover:underline">Abrir</a>
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
              <Button variant="outline" size="sm"><Pencil aria-hidden="true" /> Editar</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Dados do cliente</DialogTitle>
                <DialogDescription>Cadastro central usado por todos os setores. Datas, escopo e valor do contrato ficam em Contratos.</DialogDescription>
              </DialogHeader>
              <form id="client-data" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
                <FormField label="Nome" required error={form.formState.errors.name?.message}>
                  <Input autoComplete="off" {...form.register("name")} />
                </FormField>
                <FormField label="Nº do cliente" required error={form.formState.errors.code?.message}>
                  <Input inputMode="numeric" autoComplete="off" {...form.register("code")} />
                </FormField>
                <FormField label="Responsável pela comunicação" optional className="sm:col-span-2" hint="Quem da Extend atende o cliente. Recebe os avisos de contrato.">
                  <Controller
                    control={form.control}
                    name="owner_id"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full" aria-label="Responsável pela comunicação"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Ninguém definido</SelectItem>
                          {team.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  />
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
                {showValues && (
                  <>
                    <FormField label="Forma de pagamento" optional>
                      <Input autoComplete="off" {...form.register("payment_method")} />
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
                  {pending ? "Salvando…" : "Salvar dados"}
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
            <dt className="shrink-0 text-muted-foreground">{k}</dt>
            <dd className="min-w-0 text-right break-words">{v}</dd>
          </div>
        ))}
        {client.notes && <p className="mt-2 border-t pt-2 whitespace-pre-line text-muted-foreground">{client.notes}</p>}
      </dl>
    </Section>
  );
}
