import { z } from "zod";

// Resumo do quadro do Trello que o navegador manda ao servidor (ver src/domain/tasks/trello.ts).
const uuid = z.uuid();
const iso = z.iso.datetime({ offset: true }).nullable();
const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const text = (max: number) => z.string().max(max);

export const trelloPayloadSchema = z.object({
  sourceId: z.string().regex(/^[0-9a-f]{24}$/, "Arquivo do Trello inválido."),
  sourceName: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1, "Dê um nome ao quadro.").max(60, "Use até 60 caracteres."),
  columns: z
    .array(z.object({ name: z.string().trim().min(1).max(60), color: hex, done: z.boolean() }))
    .min(1, "O quadro precisa de ao menos uma lista aberta.")
    .max(50, "O quadro pode ter até 50 listas.")
    .refine((c) => c.some((x) => x.done), "Marque ao menos uma lista como concluída."),
  cards: z
    .array(
      z.object({
        col: z.number().int().min(0).max(49),
        title: z.string().trim().min(1).max(200),
        desc: text(10000),
        due: iso,
        start: iso,
        created: iso,
        closedAt: iso,
        pos: z.number().positive(),
        labels: z.array(z.object({ name: z.string().trim().min(1).max(40), color: hex })).max(20),
        assignee: uuid.nullable(),
        participants: z.array(uuid).max(20),
        checklist: z.array(z.object({ title: z.string().trim().min(1).max(200), done: z.boolean() })).max(200),
        comments: z.array(z.object({ author: text(120), at: z.iso.datetime({ offset: true }), text: z.string().min(1).max(3800) })).max(500),
        links: z.array(z.object({ name: text(200), url: z.url().max(1000) })).max(100),
      }),
    )
    .max(1000, "O quadro tem mais de 1.000 cards. Arquive os antigos no Trello e exporte de novo."),
});
