"use server";

import { revalidatePath } from "next/cache";
import { periodRange, type Period } from "@/domain/ads";
import { DEFAULT_REPORT_TEMPLATE, buildAdsReport, lastWeek } from "@/domain/ads/report";
import { todayKey } from "@/domain/media";
import { fail, ok } from "@/domain/shared/result";
import { defineAction, must } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { clientReportData } from "@/lib/whatsapp/reports";
import { clientTemplateSchema, reportPreviewSchema, reportTemplateIdSchema, reportTemplateSchema } from "./schemas";

// Modelos de relatório (RF-REL-02) e prévia com os números reais (RF-REL-03). O banco confere quem pode o quê.

export const saveReportTemplate = defineAction({ schema: reportTemplateSchema, permission: "reports.manage" }, async ({ id, name, body, isDefault }) => {
  const supabase = await createClient();
  const saved = must(await supabase.rpc("save_report_template", { p_id: id ?? (null as unknown as string), p_name: name, p_body: body, p_default: isDefault })) as string;
  revalidatePath("/configuracoes/relatorios");
  return ok({ id: saved }, id ? "Modelo salvo." : "Modelo criado.");
});

export const deleteReportTemplate = defineAction({ schema: reportTemplateIdSchema, permission: "reports.manage" }, async ({ id }) => {
  const supabase = await createClient();
  must(await supabase.rpc("delete_report_template", { p_id: id }));
  revalidatePath("/configuracoes/relatorios");
  return ok(null, "Modelo excluído. Os clientes que usavam passam a usar o padrão.");
});

export const setClientReportTemplate = defineAction({ schema: clientTemplateSchema, permission: "reports.manage" }, async ({ clientId, templateId }) => {
  const supabase = await createClient();
  must(await supabase.rpc("set_client_report_template", { p_client: clientId, p_template: templateId ?? (null as unknown as string) }));
  revalidatePath(`/clientes/${clientId}/anuncios`);
  revalidatePath("/configuracoes/relatorios");
  return ok(null, templateId ? "Modelo do cliente salvo." : "O cliente volta a usar o modelo padrão.");
});

/** Texto do relatório do cliente no período, no modelo escolhido (ou no dele), com os números que a pessoa vê. */
export const previewClientReport = defineAction({ schema: reportPreviewSchema, permission: "ads.read" }, async ({ clientId, period, templateId }) => {
  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("id, name").eq("id", clientId).maybeSingle();
  if (!client) return fail("not_found", "Cliente não encontrado.");
  let body: string | undefined;
  if (templateId) {
    const { data: t } = await supabase.from("report_templates").select("body").eq("id", templateId).maybeSingle();
    if (!t) return fail("not_found", "Modelo não encontrado.");
    body = t.body;
  } else {
    const { data: own } = await supabase.from("client_report_settings").select("report_templates(body)").eq("client_id", clientId).maybeSingle();
    const t = (Array.isArray(own?.report_templates) ? own.report_templates[0] : own?.report_templates) as { body: string } | null | undefined;
    body = t?.body ?? (await supabase.from("report_templates").select("body").eq("is_default", true).maybeSingle()).data?.body ?? DEFAULT_REPORT_TEMPLATE;
  }
  const today = todayKey(new Date());
  const range = period === "semana" ? lastWeek(today) : periodRange(period as Period, today);
  const data = await clientReportData(client, range);
  if (!data.accounts.length) return fail("forbidden", "Você não vê as contas de anúncio deste cliente.");
  const text = buildAdsReport(data, body);
  return ok({ text, range });
});
