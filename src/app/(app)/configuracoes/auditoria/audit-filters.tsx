"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ENTITY_LABEL, PERIODS } from "./labels";

const ALL = "__todos";

export function AuditFilters({ users, usuario, tabela, periodo }: { users: { id: string; name: string }[]; usuario: string; tabela: string; periodo: string }) {
  const router = useRouter();
  const go = (patch: Record<string, string>) => {
    const next = { usuario, tabela, periodo, ...patch };
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v && v !== ALL) u.set(k, v);
    router.push(`/configuracoes/auditoria?${u}`);
  };
  return (
    <div className="flex flex-wrap gap-2">
      <Select value={usuario || ALL} onValueChange={(v) => go({ usuario: v })}>
        <SelectTrigger className="w-full sm:w-56" aria-label="Filtrar por usuário">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos os usuários</SelectItem>
          {users.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={tabela || ALL} onValueChange={(v) => go({ tabela: v })}>
        <SelectTrigger className="w-full sm:w-56" aria-label="Filtrar pelo que foi alterado">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Tudo</SelectItem>
          {Object.entries(ENTITY_LABEL).map(([k, v]) => (
            <SelectItem key={k} value={k}>
              {v[0].toUpperCase() + v.slice(1)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={periodo} onValueChange={(v) => go({ periodo: v })}>
        <SelectTrigger className="w-full sm:w-48" aria-label="Período">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(PERIODS).map(([k, v]) => (
            <SelectItem key={k} value={k}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
