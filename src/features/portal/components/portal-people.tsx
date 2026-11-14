"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LoaderCircle, MailPlus, PauseCircle, PlayCircle, RotateCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormAlert, FormField } from "@/components/app/form-field";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { formatDateTime, formatRelative } from "@/domain/shared/dates";
import { cancelPortalInvite, invitePortalUser, resendPortalInvite, setPortalUserActive } from "@/features/portal/actions";
import { portalInviteSchema } from "@/features/portal/schemas";
import type { PortalPeople as People } from "@/features/portal/queries";
import { handleResult } from "@/lib/action-feedback";

function InviteForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = portalInviteSchema.safeParse({ clientId, fullName, email });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[i.path.join(".")] ??= i.message;
      setErrors(errs);
      return;
    }
    setErrors({});
    setAlert(null);
    start(async () => {
      const res = await invitePortalUser(parsed.data);
      if (!res.ok) {
        setAlert(res.message);
        if (res.fieldErrors) setErrors(Object.fromEntries(Object.entries(res.fieldErrors).map(([k, m]) => [k, m[0]])));
        return;
      }
      handleResult(res);
      setFullName("");
      setEmail("");
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-3 rounded-xl border bg-card p-4">
      <h3 className="text-sm font-semibold">Convidar pessoa do cliente</h3>
      <FormAlert>{alert}</FormAlert>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Nome" required error={errors.fullName}>
          <Input value={fullName} maxLength={120} autoComplete="off" placeholder="Ex.: Carla Souza…" onChange={(e) => setFullName(e.target.value)} />
        </FormField>
        <FormField label="E-mail" required error={errors.email}>
          <Input type="email" value={email} maxLength={200} autoComplete="off" spellCheck={false} placeholder="Ex.: carla@empresa.com.br…" onChange={(e) => setEmail(e.target.value)} />
        </FormField>
      </div>
      <p className="text-xs text-muted-foreground">A pessoa recebe um e-mail para criar a senha. O convite vale 7 dias.</p>
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <MailPlus aria-hidden="true" />} Enviar convite
      </Button>
    </form>
  );
}

/** Pessoas do cliente com acesso, convites em aberto e o formulário de convite (RF-ACL-01). */
export function PortalPeople({ clientId, people, canManage }: { clientId: string; people: People; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Parameters<typeof handleResult>[0]>) =>
    start(async () => {
      if (handleResult(await fn())) router.refresh();
    });

  return (
    <div className="grid gap-4">
      {canManage && <InviteForm clientId={clientId} />}
      {people.users.length === 0 && people.invites.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-surface p-4 text-sm text-muted-foreground">
          Ninguém do cliente tem acesso ainda.{canManage ? " Convide a pessoa que acompanha o projeto do lado do cliente." : " Quem gerencia a área do cliente pode convidar."}
        </p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {people.users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <div className="grid min-w-0 flex-1 basis-56 gap-0.5">
                <span className="text-sm font-medium break-words">{u.name || u.email}</span>
                <span className="text-xs break-all text-muted-foreground">{u.email}</span>
                <span className="text-xs text-muted-foreground">
                  {u.active ? (u.last_seen_at ? `Último acesso ${formatRelative(u.last_seen_at)}` : "Ainda não entrou") : "Acesso pausado"}
                </span>
              </div>
              {canManage &&
                (u.active ? (
                  <ConfirmDialog
                    trigger={<Button variant="outline" size="sm" disabled={pending}><PauseCircle aria-hidden="true" /> Pausar acesso</Button>}
                    title={`Pausar o acesso de ${u.name || u.email}?`}
                    description="A pessoa é desconectada em todos os aparelhos e avisada por e-mail. Dá para reativar depois."
                    confirmLabel="Pausar acesso"
                    onConfirm={async () => handleResult(await setPortalUserActive({ clientId, userId: u.id, active: false })) && (router.refresh(), true)}
                  />
                ) : (
                  <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => setPortalUserActive({ clientId, userId: u.id, active: true }))}>
                    <PlayCircle aria-hidden="true" /> Reativar
                  </Button>
                ))}
            </li>
          ))}
          {people.invites.map((i) => {
            const expired = i.expired;
            return (
              <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="grid min-w-0 flex-1 basis-56 gap-0.5">
                  <span className="text-sm font-medium break-words">{i.name || i.email}</span>
                  <span className="text-xs break-all text-muted-foreground">{i.email}</span>
                  <span className={expired ? "text-xs text-danger" : "text-xs text-muted-foreground"}>
                    {expired ? `Convite vencido em ${formatDateTime(i.expires_at)}` : `Convite pendente, vale até ${formatDateTime(i.expires_at)}`}
                  </span>
                </div>
                {canManage && (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => resendPortalInvite({ clientId, id: i.id }))}>
                      <RotateCw aria-hidden="true" /> Reenviar
                    </Button>
                    <ConfirmDialog
                      trigger={<Button variant="ghost" size="sm" disabled={pending}><XCircle aria-hidden="true" /> Revogar</Button>}
                      title={`Revogar o convite de ${i.email}?`}
                      description="O link do e-mail deixa de funcionar."
                      confirmLabel="Revogar convite"
                      onConfirm={async () => handleResult(await cancelPortalInvite({ clientId, id: i.id })) && (router.refresh(), true)}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
