import { z } from "zod";
import { PLAYBOOK_AREAS, STEP_TASK_TYPES } from "@/domain/playbooks";

const uuid = z.uuid();

export const playbookSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(2, "Dê um nome ao playbook.").max(120, "Use até 120 caracteres."),
  area: z.enum(PLAYBOOK_AREAS),
  description: z.string().trim().max(1000, "Use até 1000 caracteres.").default(""),
  isActive: z.boolean(),
});
export type PlaybookInput = z.infer<typeof playbookSchema>;

export const stepSchema = z.object({
  id: uuid.optional(),
  playbookId: uuid,
  title: z.string().trim().min(2, "Descreva a etapa.").max(160, "Use até 160 caracteres."),
  guidance: z.string().trim().max(2000, "Use até 2000 caracteres.").default(""),
  offsetDays: z.number({ message: "Informe o dia." }).int("Use um número inteiro.").min(0, "Use 0 ou mais.").max(365, "Use até 365 dias."),
  dayKind: z.enum(["uteis", "corridos"]),
  sectorId: uuid.nullable(),
  taskType: z.enum(STEP_TASK_TYPES),
  milestone: z.string().trim().max(60, "Use até 60 caracteres.").default(""),
});
export type StepInput = z.infer<typeof stepSchema>;

export const applySchema = z.object({
  playbookId: uuid,
  clientId: z.uuid({ message: "Escolha o cliente." }),
  startOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha a data de início."),
});

export const moveStepSchema = z.object({ id: uuid, playbookId: uuid, direction: z.enum(["up", "down"]) });
