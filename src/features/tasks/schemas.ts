import { z } from "zod";

const uuid = z.uuid("Identificador inválido.");
const TYPES = ["video", "design", "conteudo", "gravacao", "site", "criativo", "roteiro", "post", "geral"] as const;
const PRIORITIES = ["baixa", "media", "alta", "urgente"] as const;

const repeat = z.object({ unit: z.enum(["dia", "semana", "mes"]), every: z.number().int().min(1).max(52) }).nullable();

export const createTaskSchema = z.object({
  repeat: repeat.optional(),
  title: z.string().trim().min(2, "Dê um título à demanda.").max(200),
  clientId: uuid.nullable().optional(),
  type: z.enum(TYPES),
  assigneeId: uuid.nullable().optional(),
  dueAt: z.string().nullable().optional(),
  description: z.string().max(10000).optional(),
  priority: z.enum(PRIORITIES).default("media"),
  boardId: uuid.nullable().optional(),
  columnId: uuid.nullable().optional(),
});

export const updateTaskSchema = z.object({
  id: uuid,
  repeat: repeat.optional(),
  title: z.string().trim().min(2, "Dê um título à demanda.").max(200).optional(),
  description: z.string().max(10000).nullable().optional(),
  priority: z.enum(PRIORITIES).optional(),
  dueAt: z.string().nullable().optional(),
  assigneeId: uuid.nullable().optional(),
  blockedBy: uuid.nullable().optional(),
  waitingNote: z.string().max(300).nullable().optional(),
});

export const moveSchema = z.object({ id: uuid, stepId: uuid.nullable(), columnId: uuid.nullable(), position: z.number().finite().nullable() });

export const tagSchema = z.object({ name: z.string().trim().min(1, "Dê um nome.").max(40), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/) });

export const commentSchema = z.object({ taskId: uuid, body: z.string().trim().min(1, "Escreva o comentário.").max(4000) });

export const linkSchema = z.object({
  taskId: uuid,
  name: z.string().trim().min(1).max(200),
  url: z.url("Link inválido.").max(1000),
});

export const boardSchema = z.object({ id: uuid.optional(), name: z.string().trim().min(2, "Dê um nome ao quadro.").max(80), sectorId: uuid.nullable().optional() });

export const columnSchema = z.object({
  id: uuid.optional(),
  boardId: uuid,
  name: z.string().trim().min(1, "Dê um nome à coluna.").max(60),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#64748B"),
  isDone: z.boolean().default(false),
});

export const stepSchema = z.object({
  id: uuid.optional(),
  workflowId: uuid,
  name: z.string().trim().min(1, "Dê um nome à etapa.").max(60),
  sectorId: uuid.nullable(),
  status: z.enum(["pendente", "em_andamento", "aguardando_aprovacao", "aprovado", "concluido"]),
  waitsClient: z.boolean(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

export const eventSchema = z
  .object({
    id: uuid.optional(),
    title: z.string().trim().min(2, "Dê um título.").max(160),
    kind: z.enum(["gravacao", "reuniao", "evento", "bloqueio"]),
    sectorId: uuid.nullable().optional(),
    clientId: uuid.nullable().optional(),
    taskId: uuid.nullable().optional(),
    startsAt: z.string().min(10, "Informe o início."),
    endsAt: z.string().min(10, "Informe o fim."),
    location: z.string().max(300).optional(),
    link: z.url("Link inválido.").optional().or(z.literal("")),
    notes: z.string().max(4000).optional(),
    attendeeIds: z.array(uuid).max(40).default([]),
  })
  .refine((e) => new Date(e.endsAt) > new Date(e.startsAt), { path: ["endsAt"], message: "O fim precisa ser depois do início." });
