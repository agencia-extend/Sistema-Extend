"use client";

import { useState, useTransition } from "react";
import { Link2, LoaderCircle, Mail, Undo2, UserPlus, UserX } from "lucide-react";
import type { PlaceholderRow } from "@/features/admin/queries";
import { dismissPlaceholder, linkPlaceholder } from "@/features/admin/placeholders";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/app/form-field";
import { handleResult } from "@/lib/action-feedback";
import { InviteDialog } from "./invite-dialog";

type Option = { id: string; name: string };

// Pessoas do Trello a cadastrar: o gerente convida cada nome (com e-mail e papel) ou liga a quem já tem acesso.
export function PlaceholderList({ rows, roles, sectors, users }: { rows: PlaceholderRow[]; roles: Option[]; sectors: Option[]; users: Option[] }) {
  const open = rows.filter((r) => !r.profile && !r.dismissed);
  const linked = rows.filter((r) => r.profile);
  const dismissed = rows.filter((r) => !r.profile && r.dismissed);
  return (
    <div className="grid gap-3">
      {open.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todos os nomes do Trello já foram cadastrados ou tirados da lista.</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {open.map((r) => (
            <li key={r.id} className="grid gap-3 px-4 py-3 sm:flex sm:flex-wrap sm:items-center sm:gap-x-4">
              <div className="grid min-w-0 flex-1 basis-64 gap-0.5">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {r.name}
                  {r.sector && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-normal">
                      <span className="size-2 rounded-full" style={{ background: r.sector.color }} aria-hidden="true" />
                      {r.sector.name}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className="tabular">{r.cards}</span> {r.cards === 1 ? "card" : "cards"} (<span className="tabular">{r.open}</span> {r.open === 1 ? "aberto" : "abertos"})
                  {r.clients.length > 0 && ` · ${r.clients.slice(0, 4).join(", ")}${r.clients.length > 4 ? ` e mais ${r.clients.length - 4}` : ""}`}
                </p>
                {r.note && <p className="text-xs text-muted-foreground">{r.note}</p>}
                <p className="text-xs text-muted-foreground">No Trello: {r.aliases.join(", ")}</p>
                {r.invitation?.status === "pendente" && (
                  <p className="inline-flex items-center gap-1.5 text-xs text-primary">
                    <Mail className="size-3.5" aria-hidden="true" /> Convite enviado para {r.invitation.email}. Os cards passam para a pessoa quando ela aceitar.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {r.invitation?.status !== "pendente" && (
                  <InviteDialog
                    roles={roles}
                    sectors={sectors}
                    preset={{ placeholderId: r.id, fullName: r.name, sectorIds: r.sector ? [r.sector.id] : [] }}
                    trigger={
                      <Button size="sm">
                        <UserPlus aria-hidden="true" /> Convidar
                      </Button>
                    }
                  />
                )}
                <LinkDialog row={r} users={users} />
                <ConfirmDialog
                  trigger={
                    <Button variant="ghost" size="sm">
                      <UserX aria-hidden="true" /> Não é da equipe
                    </Button>
                  }
                  title={`Tirar ${r.name} da lista?`}
                  description="Use quando o nome é de alguém do cliente ou de quem não trabalha mais na Extend. Os cards continuam sem responsável e o nome pode voltar para a lista depois."
                  confirmLabel="Tirar da lista"
                  onConfirm={async () => handleResult(await dismissPlaceholder({ placeholderId: r.id, dismiss: true }))}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      {linked.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Já ligados: {linked.map((r) => `${r.name} → ${r.profile?.full_name}`).join(" · ")}
        </p>
      )}
      {dismissed.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Tirados da lista ({dismissed.length})</summary>
          <ul className="mt-2 grid gap-1">
            {dismissed.map((r) => (
              <li key={r.id} className="flex items-center gap-2">
                {r.name}
                <RestoreButton id={r.id} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function RestoreButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(async () => void handleResult(await dismissPlaceholder({ placeholderId: id, dismiss: false })))}>
      <Undo2 aria-hidden="true" /> Voltar para a lista
    </Button>
  );
}

function LinkDialog({ row, users }: { row: PlaceholderRow; users: Option[] }) {
  const [open, setOpen] = useState(false);
  const [profileId, setProfileId] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const submit = () => {
    if (!profileId) return setError("Escolha uma pessoa.");
    start(async () => {
      if (handleResult(await linkPlaceholder({ placeholderId: row.id, profileId }))) setOpen(false);
    });
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Link2 aria-hidden="true" /> Já tem acesso
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ligar {row.name} a quem já tem acesso</DialogTitle>
          <DialogDescription>
            Os {row.cards} cards com este nome passam para a pessoa escolhida: ela vira responsável onde o card está sem ninguém e participante nos demais. Ela recebe um aviso só.
          </DialogDescription>
        </DialogHeader>
        <FormField label="Pessoa" error={error} required>
          <Select
            value={profileId}
            onValueChange={(v) => {
              setProfileId(v);
              setError(undefined);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Escolha quem é" />
            </SelectTrigger>
            <SelectContent>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            Ligar e passar os cards
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
