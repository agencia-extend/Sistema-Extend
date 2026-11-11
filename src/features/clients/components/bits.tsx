import { STATUS_LABEL, STATUS_TONE, type ClientStatus } from "@/domain/clients";
import { cn } from "@/lib/utils";

const TONE = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  neutral: "bg-neutral-soft text-neutral-status",
  info: "bg-info-soft text-info",
  danger: "bg-danger-soft text-danger",
} as const;

export function Pill({ tone, children, className }: { tone: keyof typeof TONE; children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", TONE[tone], className)}>{children}</span>;
}

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  return <Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Pill>;
}

/** Barra de progresso acessível. value = 0..100 ou null (sem dado). */
export function ProgressBar({ value, label, tone = "info" }: { value: number | null; label: string; tone?: "info" | "warning" | "success" }) {
  const color = { info: "bg-brand", warning: "bg-warning", success: "bg-success" }[tone];
  return (
    <div className="grid gap-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="tabular">{value === null ? "—" : `${value}%`}</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value ?? undefined}
      >
        <div className={cn("h-full rounded-full", color)} style={{ width: `${value ?? 0}%` }} />
      </div>
    </div>
  );
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

export function Avatars({ people, max = 4 }: { people: { id: string; name: string; sector?: string }[]; max?: number }) {
  const uniq = [...new Map(people.map((p) => [p.id, p])).values()];
  if (!uniq.length) return <span className="text-xs text-muted-foreground">Sem responsáveis</span>;
  return (
    <ul className="flex -space-x-1.5" aria-label="Responsáveis">
      {uniq.slice(0, max).map((p) => (
        <li
          key={p.id}
          title={p.sector ? `${p.name} · ${p.sector}` : p.name}
          className="grid size-7 place-items-center rounded-full border-2 border-card bg-accent text-[10px] font-semibold text-accent-foreground"
        >
          <span aria-hidden="true">{initials(p.name)}</span>
          <span className="sr-only">{p.name}</span>
        </li>
      ))}
      {uniq.length > max && (
        <li className="grid size-7 place-items-center rounded-full border-2 border-card bg-muted text-[10px] font-semibold">+{uniq.length - max}</li>
      )}
    </ul>
  );
}
