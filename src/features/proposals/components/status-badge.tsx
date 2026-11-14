import { STATUS_LABEL, STATUS_TONE, type ProposalStatus } from "@/domain/proposals";
import { cn } from "@/lib/utils";

const TONE = {
  neutral: "bg-neutral-soft text-neutral-status",
  info: "bg-info-soft text-info",
  warning: "bg-warning-soft text-warning",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
} as const;

export function ProposalStatusBadge({ status, className }: { status: ProposalStatus; className?: string }) {
  return <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap", TONE[STATUS_TONE[status]], className)}>{STATUS_LABEL[status]}</span>;
}
