"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LoaderCircle, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert } from "@/components/app/form-field";
import { formatDateTime } from "@/domain/shared/dates";
import { saveStrategy } from "@/features/portal/actions";
import type { StrategyRow } from "@/features/portal/queries";
import { handleResult } from "@/lib/action-feedback";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { RichText } from "./rich-text";

/** Estratégia/planejamento do cliente: rascunho da equipe e versão publicada na área do cliente. */
export function StrategyEditor({ clientId, strategy, canManage }: { clientId: string; strategy: StrategyRow | null; canManage: boolean }) {
  const router = useRouter();
  const initial = strategy?.draft ?? "";
  const [body, setBody] = useState(initial);
  const [alert, setAlert] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"save" | "publish" | null>(null);
  const dirty = body !== initial;
  const unpublished = Boolean(strategy && strategy.draft !== (strategy.published ?? ""));
  useUnsavedGuard(dirty && !pending);

  const submit = (publish: boolean) => {
    if (publish && body.trim().length < 20) return setAlert("Escreva a estratégia antes de publicar (pelo menos 20 caracteres).");
    setAlert(null);
    setMode(publish ? "publish" : "save");
    start(async () => {
      const res = await saveStrategy({ clientId, body, publish });
      if (!res.ok) return setAlert(res.message);
      handleResult(res);
      router.refresh();
    });
  };

  if (!canManage) {
    return strategy?.published ? (
      <div className="grid gap-2 rounded-xl border bg-card p-4">
        <p className="text-xs text-muted-foreground">Publicada {strategy.publishedAt ? `em ${formatDateTime(strategy.publishedAt)}` : ""}{strategy.publishedBy ? ` por ${strategy.publishedBy}` : ""}.</p>
        <RichText text={strategy.published} className="text-sm leading-relaxed" />
      </div>
    ) : (
      <p className="rounded-xl border border-dashed bg-surface p-4 text-sm text-muted-foreground">Nenhuma estratégia publicada para o cliente ainda.</p>
    );
  }

  return (
    <div className="grid gap-3 rounded-xl border bg-card p-4">
      <FormAlert>{alert}</FormAlert>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Texto que o cliente vê</span>
        <Textarea
          rows={12}
          maxLength={20000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={"Ex.: **Objetivo do trimestre**\nGerar 40 leads qualificados por mês.\n\n- Reels semanais com bastidores\n- Campanha de captação no Instagram…"}
        />
        <span className="text-xs text-muted-foreground">Parágrafos separados por linha em branco, listas com “- ” e **negrito**. Valores de contrato e anotações internas não devem entrar aqui.</span>
      </label>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {strategy?.publishedAt
          ? `Publicada em ${formatDateTime(strategy.publishedAt)}${strategy.publishedBy ? ` por ${strategy.publishedBy}` : ""}.${unpublished || dirty ? " Há mudanças que o cliente ainda não vê." : ""}`
          : "Ainda não publicada: o cliente não vê esta seção."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => submit(true)} disabled={pending}>
          {pending && mode === "publish" ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />} Publicar para o cliente
        </Button>
        <Button variant="outline" onClick={() => submit(false)} disabled={pending || !dirty}>
          {pending && mode === "save" ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />} Salvar rascunho
        </Button>
      </div>
    </div>
  );
}
