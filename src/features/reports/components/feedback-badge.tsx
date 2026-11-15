import { CheckCircle2, CircleAlert, Clock3, PhoneCall } from "lucide-react";
import { FEEDBACK_LABEL, type Feedback } from "@/domain/reports";
import { cn } from "@/lib/utils";

const STYLE: Record<Feedback | "aguardando", { cls: string; Icon: typeof CheckCircle2; label: string }> = {
  positivo: { cls: "text-success", Icon: CheckCircle2, label: FEEDBACK_LABEL.positivo },
  negativo: { cls: "text-danger", Icon: CircleAlert, label: FEEDBACK_LABEL.negativo },
  sem_retorno: { cls: "text-warning", Icon: PhoneCall, label: FEEDBACK_LABEL.sem_retorno },
  aguardando: { cls: "text-muted-foreground", Icon: Clock3, label: "Aguardando retorno" },
};

/** Retorno do cliente ao relatório, com ícone e cor (o texto sempre aparece). */
export function FeedbackBadge({ feedback, className }: { feedback: Feedback | null; className?: string }) {
  const s = STYLE[feedback ?? "aguardando"];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", s.cls, className)}>
      <s.Icon className="size-4 shrink-0" aria-hidden="true" /> {s.label}
    </span>
  );
}
