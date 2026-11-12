"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addMember, removeMember } from "@/features/clients/actions";
import { handleResult } from "@/lib/action-feedback";
import { Section } from "./section";

type Sector = { id: string; name: string; color: string };
type Person = { id: string; name: string; sectorIds: string[] };
type Member = { sectorId: string; profileId: string; name: string };

/** Responsáveis por setor (RF-CLI-04). Marcar = acesso ao cliente e às demandas dele. */
export function TeamCard({ clientId, canManage, sectors, team, members }: { clientId: string; canManage: boolean; sectors: Sector[]; team: Person[]; members: Member[] }) {
  const [sector, setSector] = useState("");
  const [person, setPerson] = useState("");
  const [pending, startTransition] = useTransition();
  const shown = sectors.filter((s) => members.some((m) => m.sectorId === s.id));
  const candidates = team
    .filter((p) => !members.some((m) => m.sectorId === sector && m.profileId === p.id))
    .sort((a, b) => Number(b.sectorIds.includes(sector)) - Number(a.sectorIds.includes(sector)));

  const add = () =>
    startTransition(async () => {
      if (handleResult(await addMember({ clientId, sectorId: sector, profileId: person }))) setPerson("");
    });

  return (
    <Section title="Equipe do cliente">
      <p className="-mt-2 text-xs text-muted-foreground">Quem é marcado aqui passa a ver o cliente e recebe as demandas do setor.</p>
      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-surface p-4 text-sm text-muted-foreground">Ninguém marcado ainda.</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {shown.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <span className="flex w-40 items-center gap-2 text-sm text-muted-foreground">
                <span className="size-2 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                {s.name}
              </span>
              <ul className="flex flex-1 flex-wrap gap-1.5">
                {members
                  .filter((m) => m.sectorId === s.id)
                  .map((m) => (
                    <li key={m.profileId} className="inline-flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-2.5 text-sm">
                      {m.name}
                      {canManage && (
                        <button
                          type="button"
                          className="grid size-7 place-items-center rounded-full hover:bg-muted pointer-coarse:size-10"
                          aria-label={`Remover ${m.name} de ${s.name}`}
                          disabled={pending}
                          onClick={() => startTransition(async () => void handleResult(await removeMember({ clientId, sectorId: s.id, profileId: m.profileId })))}
                        >
                          <X className="size-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </li>
                  ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {canManage && (
        <div className="flex flex-wrap gap-2">
          <Select value={sector} onValueChange={(v) => (setSector(v), setPerson(""))}>
            <SelectTrigger className="w-full sm:w-48" aria-label="Setor">
              <SelectValue placeholder="Setor" />
            </SelectTrigger>
            <SelectContent>
              {sectors.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={person} onValueChange={setPerson} disabled={!sector}>
            <SelectTrigger className="w-full sm:w-56" aria-label="Pessoa">
              <SelectValue placeholder="Pessoa" />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                  {!p.sectorIds.includes(sector) && " (outro setor)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={add} disabled={!sector || !person || pending}>
            <Plus aria-hidden="true" /> Marcar
          </Button>
        </div>
      )}
    </Section>
  );
}
