export type TaskStatus = "pendente" | "em_andamento" | "aguardando_aprovacao" | "aprovado" | "concluido" | "cancelado";

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  aguardando_aprovacao: "Aguardando aprovação",
  aprovado: "Aprovado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export const TASK_STATUS_TONE: Record<TaskStatus, "neutral" | "info" | "warning" | "success"> = {
  pendente: "neutral",
  em_andamento: "info",
  aguardando_aprovacao: "warning",
  aprovado: "success",
  concluido: "success",
  cancelado: "neutral",
};
