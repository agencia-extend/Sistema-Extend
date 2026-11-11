import { z } from "zod";
import { PERMISSION_KEYS, SCOPES } from "@/domain/permissions";

export const uuid = z.uuid("Identificador inválido.");

export const inviteSchema = z.object({
  email: z.email("Informe um e-mail válido.").trim().toLowerCase().max(200),
  fullName: z.string().trim().min(2, "Informe o nome.").max(120),
  roleId: uuid,
  sectorIds: z.array(uuid).max(20).default([]),
});

export const invitationIdSchema = z.object({ id: uuid });

export const userIdSchema = z.object({ userId: uuid });

export const setUserActiveSchema = z.object({ userId: uuid, active: z.boolean() });

export const updateUserAccessSchema = z.object({
  userId: uuid,
  roleId: uuid,
  sectorIds: z.array(uuid).max(20),
  jobTitle: z.string().trim().max(80).optional().or(z.literal("")),
});

const permissionKey = z.enum(PERMISSION_KEYS);
const scope = z.enum(SCOPES as [string, ...string[]]);

export const overrideSchema = z.object({
  userId: uuid,
  permissionKey,
  effect: z.enum(["grant", "deny", "none"]),
  scope: scope.default("all"),
});

export const roleSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(2, "Dê um nome ao papel.").max(60),
  description: z.string().trim().max(300).default(""),
});

export const rolePermissionSchema = z.object({
  roleId: uuid,
  permissionKey,
  scope: scope.nullable(),
});

export const duplicateRoleSchema = z.object({ roleId: uuid, name: z.string().trim().min(2, "Dê um nome ao papel.").max(60) });

export const sectorSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(2, "Dê um nome ao setor.").max(60),
  area: z.enum(["gestao", "trafego", "criacao"]),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Escolha uma cor."),
  isActive: z.boolean().default(true),
});
