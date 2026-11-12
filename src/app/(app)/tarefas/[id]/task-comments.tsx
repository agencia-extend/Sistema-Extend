"use client";

import { useRef, useState, useTransition } from "react";
import { AtSign, LoaderCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addComment, deleteComment } from "@/features/tasks/actions";
import { handleResult } from "@/lib/action-feedback";
import { formatDateTime, formatRelative } from "@/domain/shared/dates";
import { Section } from "@/features/clients/components/section";

type Comment = { id: string; body: string; created_at: string; author_id: string; author: string };

/** Comentários com @menção: quem é mencionado recebe notificação (RF-TAR-02). */
export function TaskComments({ taskId, comments, team, userId }: { taskId: string; comments: Comment[]; team: { id: string; name: string }[]; userId: string }) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const area = useRef<HTMLTextAreaElement>(null);

  const mention = (name: string) => {
    const first = name.split(" ")[0];
    setBody((b) => `${b}${b && !b.endsWith(" ") ? " " : ""}@${first} `);
    area.current?.focus();
  };

  return (
    <Section title={`Comentários (${comments.length})`}>
      <ol className="grid gap-3">
        {comments.map((c) => (
          <li key={c.id} className="grid gap-1 rounded-xl border bg-card p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{c.author}</span>
              <time dateTime={c.created_at} title={formatDateTime(c.created_at)}>{formatRelative(c.created_at)}</time>
              {c.author_id === userId && (
                <Button variant="ghost" size="icon" className="ml-auto size-8" aria-label="Excluir comentário" disabled={pending}
                  onClick={() => startTransition(async () => void handleResult(await deleteComment({ id: c.id, taskId })))}>
                  <Trash2 />
                </Button>
              )}
            </div>
            <p className="text-sm break-words whitespace-pre-line">{c.body}</p>
          </li>
        ))}
      </ol>
      <form
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            if (handleResult(await addComment({ taskId, body }))) setBody("");
          });
        }}
      >
        <Textarea
          ref={area}
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escreva um comentário. Use @Nome para avisar alguém…"
          aria-label="Novo comentário"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && body.trim()) e.currentTarget.form?.requestSubmit();
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending || !body.trim()}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Comentar
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline"><AtSign aria-hidden="true" /> Mencionar</Button>
            </PopoverTrigger>
            <PopoverContent className="grid max-h-64 w-56 gap-0.5 overflow-y-auto p-1">
              {team.filter((t) => t.id !== userId).map((t) => (
                <button key={t.id} type="button" onClick={() => mention(t.name)} className="min-h-9 rounded-md px-2 text-left text-sm hover:bg-muted">{t.name}</button>
              ))}
            </PopoverContent>
          </Popover>
        </div>
      </form>
    </Section>
  );
}
