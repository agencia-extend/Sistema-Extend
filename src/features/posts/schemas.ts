import { z } from "zod";
import { POST_FORMATS, driveFileId, formatProblem, spToIso } from "@/domain/posts";

const when = { date: z.string().trim(), time: z.string().trim() };

/** Programar a mesma publicação em um ou mais perfis do cliente (Facebook e/ou Instagram). */
export const schedulePostSchema = z
  .object({
    clientId: z.uuid("Cliente inválido."),
    profileIds: z.array(z.uuid()).min(1, "Escolha onde publicar.").max(10),
    format: z.enum(POST_FORMATS, "Escolha o formato."),
    caption: z.string().max(5000, "Até 5.000 caracteres."),
    images: z.array(z.string().max(400)).max(10, "Até 10 imagens."),
    videoPath: z.string().max(400).nullable(),
    videoDriveUrl: z.string().trim().max(1000),
    taskId: z.uuid().nullable(),
    ...when,
  })
  .transform((v, ctx) => {
    const at = spToIso(v.date, v.time);
    if (!at) ctx.addIssue({ code: "custom", path: ["date"], message: "Informe a data e a hora." });
    else if (new Date(at).getTime() < Date.now() + 5 * 60_000) ctx.addIssue({ code: "custom", path: ["date"], message: "Escolha um horário a partir de 5 minutos daqui." });
    const driveId = v.videoDriveUrl ? driveFileId(v.videoDriveUrl) : null;
    if (v.videoDriveUrl && !driveId) ctx.addIssue({ code: "custom", path: ["videoDriveUrl"], message: "Cole o link de um arquivo do Google Drive." });
    const problem = formatProblem(v.format, { images: v.images.length, videos: (v.videoPath ? 1 : 0) + (driveId ? 1 : 0), caption: v.caption });
    if (problem) ctx.addIssue({ code: "custom", path: ["media"], message: problem });
    return { ...v, at: at ?? "", driveId };
  });
export type SchedulePostInput = z.input<typeof schedulePostSchema>;

export const postIdSchema = z.object({ id: z.uuid("Publicação inválida.") });

export const reschedulePostSchema = z
  .object({ id: z.uuid("Publicação inválida."), ...when })
  .transform((v, ctx) => {
    const at = spToIso(v.date, v.time);
    if (!at) ctx.addIssue({ code: "custom", path: ["date"], message: "Informe a data e a hora." });
    else if (new Date(at).getTime() < Date.now() + 5 * 60_000) ctx.addIssue({ code: "custom", path: ["date"], message: "Escolha um horário a partir de 5 minutos daqui." });
    return { id: v.id, at: at ?? "" };
  });
