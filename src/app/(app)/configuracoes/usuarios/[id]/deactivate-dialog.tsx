"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormAlert, FormField } from "@/components/app/form-field";
import { setUserActive } from "@/features/admin/actions";
import type { OpenWork } from "@/features/admin/queries";
import { handleResult } from "@/lib/action-feedback";

type Person = { id: string; name: string; crm: boolean };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Linhas do que passa para quem assume, só as que têm algo. */
function workLines(w: OpenWork): string[] {
  const lines: [number, string][] = [
    [w.tasks, plural(w.tasks, "demanda aberta (responsável, edição ou gravação)", "demandas abertas (responsável, edição ou gravação)")],
    [w.repeats, plural(w.repeats, "demanda que se repete", "demandas que se repetem")],
    [w.teams, `equipe de ${plural(w.teams, "cliente", "clientes")}`],
    [w.owned_clients, `responsável pela comunicação com ${plural(w.owned_clients, "cliente", "clientes")}`],
    [w.step_defaults, plural(w.step_defaults, "etapa em que é a pessoa padrão do cliente", "etapas em que é a pessoa padrão do cliente")],
    [w.checklist, plural(w.checklist, "passo de onboarding", "passos de onboarding")],
    [w.leads, plural(w.leads, "lead aberto", "leads abertos")],
    [w.proposals, plural(w.proposals, "proposta em andamento", "propostas em andamento")],
    [w.marketing, plural(w.marketing, "pedido de criativo agendado no calendário", "pedidos de criativo agendados no calendário")],
  ];
  return lines.filter(([n]) => n > 0).map(([, l]) => l);
}

export function DeactivateDialog({ userId, name, work, people }: { userId: string; name: string; work: OpenWork; people: Person[] }) {
  const [open, setOpen] = useState(false);
  const [successor, setSuccessor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [pending, run] = useTransition();
  const lines = workLines(work);
  const needsCrm = work.leads + work.proposals > 0;
  const options = needsCrm ? people.filter((p) => p.crm) : people;

  const confirm = () => {
    setError(null);
    setFieldError(undefined);
    if (lines.length > 0 && !successor) {
      setFieldError("Escolha quem assume o trabalho em aberto.");
      return;
    }
    run(async () => {
      const res = await setUserActive({ userId, active: false, successorId: successor || undefined });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      handleResult(res);
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (pending) return; setOpen(o); if (o) { setSuccessor(""); setError(null); setFieldError(undefined); } }}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <PowerOff aria-hidden="true" /> Desativar acesso
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Desativar o acesso de {name}?</DialogTitle>
          <DialogDescription>
            A pessoa é desconectada de todos os aparelhos e não consegue mais entrar. O histórico dela continua no sistema. Você pode reativar depois.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormAlert>{error}</FormAlert>
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">{name} não tem demandas nem responsabilidades em aberto.</p>
          ) : (
            <>
              <div className="grid gap-2">
                <p className="text-sm font-medium">Em aberto com {name}:</p>
                <ul className="grid list-disc gap-1 pl-5 text-sm">
                  {lines.map((l) => <li key={l}>{l}</li>)}
                </ul>
              </div>
              <FormField
                label="Quem assume"
                required
                error={fieldError}
                hint={needsCrm ? "Só aparece quem tem acesso ao Comercial, por causa dos leads e propostas." : "A pessoa recebe tudo e é avisada uma vez, com o resumo."}
              >
                <Select value={successor} onValueChange={(v) => { setSuccessor(v); setFieldError(undefined); }}>
                  <SelectTrigger className="w-full" aria-label="Quem assume"><SelectValue placeholder="Escolha a pessoa…" /></SelectTrigger>
                  <SelectContent>{options.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </FormField>
              {options.length === 0 && (
                <p className="text-sm text-muted-foreground">Ninguém ativo pode assumir. Convide ou reative alguém com acesso ao Comercial antes de desativar.</p>
              )}
            </>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="destructive" disabled={pending || (lines.length > 0 && options.length === 0)} onClick={confirm}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            {lines.length > 0 ? "Repassar e desativar" : "Desativar acesso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
