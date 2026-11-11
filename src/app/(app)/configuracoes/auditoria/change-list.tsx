const HIDDEN = new Set(["id", "organization_id", "created_at", "updated_at", "created_by", "token_hash", "preferences"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function show(v: unknown, names: Record<string, string>): string {
  if (v === null || v === undefined || v === "") return "vazio";
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (typeof v === "string") return UUID.test(v) ? (names[v] ?? v.slice(0, 8)) : v;
  return JSON.stringify(v);
}

/** Antes/depois de uma alteração (ou retrato do registro criado/excluído). */
export function ChangeList({ action, changes, names }: { action: string; changes: Record<string, unknown>; names: Record<string, string> }) {
  const entries = Object.entries(changes ?? {}).filter(([k]) => !HIDDEN.has(k));
  if (!entries.length) return null;
  const isDiff = action === "update" || action === "soft_delete" || action === "restore";
  return (
    <dl className="grid gap-0.5 text-xs text-muted-foreground">
      {entries.slice(0, 12).map(([k, v]) => {
        const diff = isDiff && v && typeof v === "object" ? (v as { de?: unknown; para?: unknown; alterado?: boolean }) : null;
        return (
          <div key={k} className="flex flex-wrap gap-x-1.5">
            <dt className="font-medium text-foreground/80">{k}:</dt>
            <dd className="break-all">
              {diff ? (diff.alterado ? "alterado (valor protegido)" : `${show(diff.de, names)} → ${show(diff.para, names)}`) : show(v, names)}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
