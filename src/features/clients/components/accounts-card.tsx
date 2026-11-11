"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/app/form-field";
import { deleteAccount, deleteContact, saveAccount, saveContact } from "@/features/clients/actions";
import { handleResult } from "@/lib/action-feedback";
import { ACCOUNT_KINDS } from "@/domain/clients";
import { Section } from "./section";

type Account = { id: string; kind: string; value: string; label: string | null };
type Contact = { id: string; name: string; role: string | null; phone: string | null; email: string | null; is_primary: boolean };

const kindLabel = (k: string) => ACCOUNT_KINDS.find((x) => x.key === k)?.label ?? k;

/** Contas (BM, anúncio, página, Instagram, pixel…) e contatos do cliente (RF-CLI-01/03). */
export function AccountsCard({ clientId, canManage, accounts, contacts }: { clientId: string; canManage: boolean; accounts: Account[]; contacts: Contact[] }) {
  const [acc, setAcc] = useState<{ id?: string; kind: string; value: string; label: string } | null>(null);
  const [con, setCon] = useState<{ id?: string; name: string; role: string; phone: string; email: string; is_primary: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<boolean>) => startTransition(async () => void (await fn()));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Section
        title="Contas e acessos"
        action={canManage ? <Button variant="outline" size="sm" onClick={() => setAcc({ kind: "ad_account_meta", value: "", label: "" })}><Plus aria-hidden="true" /> Adicionar</Button> : undefined}
      >
        {accounts.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-surface p-4 text-sm text-muted-foreground">Cadastre BM, contas de anúncio, página, Instagram e pixel.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {accounts.map((a) => (
              <li key={a.id} className="flex items-center gap-2 px-4 py-2.5">
                <button type="button" className="grid min-w-0 flex-1 gap-0.5 text-left" disabled={!canManage} onClick={() => setAcc({ id: a.id, kind: a.kind, value: a.value, label: a.label ?? "" })}>
                  <span className="text-xs text-muted-foreground">{kindLabel(a.kind)}{a.label ? ` · ${a.label}` : ""}</span>
                  <span className="truncate text-sm">{a.value}</span>
                </button>
                {canManage && (
                  <Button variant="ghost" size="icon" className="size-9" aria-label={`Remover ${kindLabel(a.kind)}`} disabled={pending}
                    onClick={() => run(async () => handleResult(await deleteAccount({ id: a.id, clientId })))}>
                    <Trash2 />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Contatos do cliente"
        action={canManage ? <Button variant="outline" size="sm" onClick={() => setCon({ name: "", role: "", phone: "", email: "", is_primary: contacts.length === 0 })}><Plus aria-hidden="true" /> Adicionar</Button> : undefined}
      >
        {contacts.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-surface p-4 text-sm text-muted-foreground">Nenhum contato cadastrado.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {contacts.map((c) => (
              <li key={c.id} className="flex items-center gap-2 px-4 py-2.5">
                <button type="button" className="grid min-w-0 flex-1 gap-0.5 text-left" disabled={!canManage}
                  onClick={() => setCon({ id: c.id, name: c.name, role: c.role ?? "", phone: c.phone ?? "", email: c.email ?? "", is_primary: c.is_primary })}>
                  <span className="truncate text-sm font-medium">{c.name}{c.is_primary && <span className="font-normal text-muted-foreground"> · principal</span>}</span>
                  <span className="truncate text-xs text-muted-foreground">{[c.role, c.phone, c.email].filter(Boolean).join(" · ") || "Sem dados de contato"}</span>
                </button>
                {canManage && (
                  <Button variant="ghost" size="icon" className="size-9" aria-label={`Remover ${c.name}`} disabled={pending}
                    onClick={() => run(async () => handleResult(await deleteContact({ id: c.id, clientId })))}>
                    <Trash2 />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Dialog open={Boolean(acc)} onOpenChange={(v) => !v && !pending && setAcc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{acc?.id ? "Editar conta" : "Nova conta"}</DialogTitle>
            <DialogDescription>Identificadores das contas do cliente, para o tráfego e a mídia acharem rápido.</DialogDescription>
          </DialogHeader>
          {acc && (
            <div className="grid gap-4">
              <FormField label="Tipo" required>
                <Select value={acc.kind} onValueChange={(v) => setAcc({ ...acc, kind: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_KINDS.map((k) => <SelectItem key={k.key} value={k.key}>{k.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="ID, @ ou link" required>
                <Input autoComplete="off" spellCheck={false} placeholder={ACCOUNT_KINDS.find((k) => k.key === acc.kind)?.placeholder} value={acc.value} onChange={(e) => setAcc({ ...acc, value: e.target.value })} />
              </FormField>
              <FormField label="Apelido" optional hint="Ex.: “Conta principal”, “Unidade Centro”.">
                <Input autoComplete="off" value={acc.label} onChange={(e) => setAcc({ ...acc, label: e.target.value })} />
              </FormField>
            </div>
          )}
          <DialogFooter>
            <Button disabled={pending || !acc?.value.trim()} onClick={() => acc && run(async () => {
              const ok = handleResult(await saveAccount({ ...acc, kind: acc.kind as never, clientId }));
              if (ok) setAcc(null);
              return ok;
            })}>
              {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Salvar conta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(con)} onOpenChange={(v) => !v && !pending && setCon(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{con?.id ? "Editar contato" : "Novo contato"}</DialogTitle>
            <DialogDescription>Quem fala com a agência pelo cliente.</DialogDescription>
          </DialogHeader>
          {con && (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Nome" required><Input autoComplete="off" value={con.name} onChange={(e) => setCon({ ...con, name: e.target.value })} /></FormField>
              <FormField label="Cargo" optional><Input autoComplete="off" value={con.role} onChange={(e) => setCon({ ...con, role: e.target.value })} /></FormField>
              <FormField label="WhatsApp" optional><Input type="tel" autoComplete="off" value={con.phone} onChange={(e) => setCon({ ...con, phone: e.target.value })} /></FormField>
              <FormField label="E-mail" optional><Input type="email" autoComplete="off" spellCheck={false} value={con.email} onChange={(e) => setCon({ ...con, email: e.target.value })} /></FormField>
              <div className="flex min-h-10 items-center gap-2 sm:col-span-2">
                <Checkbox id="con-primary" checked={con.is_primary} onCheckedChange={(v) => setCon({ ...con, is_primary: v === true })} />
                <Label htmlFor="con-primary" className="font-normal">Contato principal</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button disabled={pending || !con?.name.trim()} onClick={() => con && run(async () => {
              const ok = handleResult(await saveContact({ ...con, clientId }));
              if (ok) setCon(null);
              return ok;
            })}>
              {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Salvar contato
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
