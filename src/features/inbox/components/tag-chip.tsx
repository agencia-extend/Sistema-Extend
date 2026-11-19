import type { TagColor } from "@/domain/inbox";
import { cn } from "@/lib/utils";

const COLORS: Record<TagColor, string> = {
  azul: "bg-info-soft text-info",
  verde: "bg-success-soft text-success",
  amarelo: "bg-warning-soft text-warning",
  vermelho: "bg-danger-soft text-danger",
  roxo: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  cinza: "bg-muted text-muted-foreground",
};

export function TagChip({ name, color, className }: { name: string; color: TagColor; className?: string }) {
  return <span className={cn("inline-flex max-w-32 items-center truncate rounded-full px-2 py-0.5 text-[11px] font-medium", COLORS[color], className)}>{name}</span>;
}
