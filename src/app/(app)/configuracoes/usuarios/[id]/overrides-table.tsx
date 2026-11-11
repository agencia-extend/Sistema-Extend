"use client";

import { useState, useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SCOPE_SHORT, SCOPES, type PermissionKey, type PermissionScope } from "@/domain/permissions";
import { setUserOverride } from "@/features/admin/actions";
import { handleResult } from "@/lib/action-feedback";
import { cn } from "@/lib/utils";

type Perm = { key: string; module: string; label: string; scoped: boolean };
type Ovr = { effect: "grant" | "deny"; scope: PermissionScope };

/** Valor do seletor: "role" (sem exceção), "deny", ou "grant:<escopo>". */
const toValue = (o: Ovr | undefined) => (!o ? "role" : o.effect === "deny" ? "deny" : `grant:${o.scope}`);

export function OverridesTable({
  userId,
  permissions,
  roleScopes,
  overrides: initial,
  effective: initialEffective,
  editable,
}: {
  userId: string;
  permissions: Perm[];
  roleScopes: Record<string, PermissionScope>;
  overrides: Record<string, Ovr>;
  effective: Record<string, PermissionScope>;
  editable: boolean;
}) {
  const [overrides, setOverrides] = useState(initial);
  const [effective, setEffective] = useState(initialEffective);
  const [pending, startTransition] = useTransition();
  const modules = [...new Set(permissions.map((p) => p.module))];

  const change = (p: Perm, value: string) => {
    const effect = value === "role" ? "none" : value === "deny" ? "deny" : "grant";
    const scope = (value.startsWith("grant:") ? value.slice(6) : "all") as PermissionScope;
    startTransition(async () => {
      const res = await setUserOverride({ userId, permissionKey: p.key as PermissionKey, effect, scope });
      if (!handleResult(res)) return;
      setOverrides((prev) => {
        const next = { ...prev };
        if (effect === "none") delete next[p.key];
        else next[p.key] = { effect, scope };
        return next;
      });
      // Mesmo cálculo do banco: negar anula; conceder vale se maior que o papel.
      setEffective((prev) => {
        const next = { ...prev };
        const role = roleScopes[p.key];
        if (effect === "deny") delete next[p.key];
        else if (effect === "grant") next[p.key] = !role || SCOPES.indexOf(scope) > SCOPES.indexOf(role) ? scope : role;
        else if (role) next[p.key] = role;
        else delete next[p.key];
        return next;
      });
    });
  };

  return (
    <div className="grid gap-6">
      {modules.map((m) => (
        <div key={m} className="overflow-hidden rounded-xl border bg-card">
          <h3 className="border-b bg-muted/50 px-4 py-2 text-sm font-semibold">{m}</h3>
          <ul className="divide-y">
            {permissions
              .filter((p) => p.module === m)
              .map((p) => {
                const eff = effective[p.key];
                const ovr = overrides[p.key];
                return (
                  <li key={p.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
                    <div className="grid min-w-0 flex-1 basis-56 gap-0.5">
                      <span className="text-sm">{p.label}</span>
                      <span className="text-xs text-muted-foreground">
                        Papel: {roleScopes[p.key] ? (p.scoped ? SCOPE_SHORT[roleScopes[p.key]] : "Sim") : "Não"}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        eff ? "bg-success-soft text-success" : "bg-neutral-soft text-neutral-status",
                        ovr && "ring-1 ring-current",
                      )}
                    >
                      {eff ? (p.scoped ? SCOPE_SHORT[eff] : "Liberado") : "Sem acesso"}
                    </span>
                    {editable && (
                      <Select value={toValue(ovr)} onValueChange={(v) => change(p, v)} disabled={pending}>
                        <SelectTrigger className="w-48" aria-label={`Exceção para ${p.label}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="role">Como no papel</SelectItem>
                          {p.scoped ? (
                            SCOPES.map((s) => (
                              <SelectItem key={s} value={`grant:${s}`}>
                                Liberar: {SCOPE_SHORT[s]}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="grant:all">Liberar</SelectItem>
                          )}
                          <SelectItem value="deny">Bloquear</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </div>
  );
}
