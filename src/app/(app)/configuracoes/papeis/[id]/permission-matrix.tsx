"use client";

import { useState, useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SCOPE_LABEL, SCOPES, type PermissionKey, type PermissionScope } from "@/domain/permissions";
import { setRolePermission } from "@/features/admin/actions";
import { handleResult } from "@/lib/action-feedback";

type Perm = { key: string; module: string; label: string; scoped: boolean };

/** Matriz módulo × ação: liga/desliga e, quando a permissão tem escopo, escolhe o alcance. */
export function PermissionMatrix({
  roleId,
  permissions,
  initial,
  editable,
}: {
  roleId: string;
  permissions: Perm[];
  initial: Record<string, PermissionScope>;
  editable: boolean;
}) {
  const [scopes, setScopes] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const modules = [...new Set(permissions.map((p) => p.module))];

  const save = (key: string, scope: PermissionScope | null) => {
    const prev = scopes[key];
    setScopes((s) => {
      const n = { ...s };
      if (scope) n[key] = scope;
      else delete n[key];
      return n;
    });
    setBusy(key);
    startTransition(async () => {
      const res = await setRolePermission({ roleId, permissionKey: key as PermissionKey, scope });
      setBusy(null);
      if (!res.ok) {
        setScopes((s) => {
          const n = { ...s };
          if (prev) n[key] = prev;
          else delete n[key];
          return n;
        });
        handleResult(res);
      }
    });
  };

  return (
    <div className="grid gap-6">
      {modules.map((m) => {
        const list = permissions.filter((p) => p.module === m);
        const on = list.filter((p) => scopes[p.key]).length;
        return (
          <section key={m} className="overflow-hidden rounded-xl border bg-card" aria-labelledby={`mod-${m}`}>
            <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-2">
              <h2 id={`mod-${m}`} className="text-sm font-semibold">
                {m}
              </h2>
              <span className="text-xs text-muted-foreground tabular">
                {on} de {list.length}
              </span>
            </div>
            <ul className="divide-y">
              {list.map((p) => {
                const scope = scopes[p.key];
                return (
                  <li key={p.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
                    <Switch
                      checked={Boolean(scope)}
                      disabled={!editable || busy === p.key}
                      onCheckedChange={(v) => save(p.key, v ? (p.scoped ? "own" : "all") : null)}
                      aria-label={p.label}
                    />
                    <span className="min-w-0 flex-1 basis-48 text-sm">{p.label}</span>
                    {p.scoped && scope && (
                      <Select value={scope} onValueChange={(v) => save(p.key, v as PermissionScope)} disabled={!editable || busy === p.key}>
                        <SelectTrigger className="w-full sm:w-64" aria-label={`Alcance de ${p.label}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SCOPES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {SCOPE_LABEL[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
