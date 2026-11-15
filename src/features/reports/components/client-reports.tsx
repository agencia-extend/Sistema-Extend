"use client";

import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { REPORT_AREA_LABEL, type ReportArea } from "@/domain/reports";
import { deleteReport } from "@/features/reports/actions";
import type { ReportRow } from "@/features/reports/queries";
import { handleResult } from "@/lib/action-feedback";
import { FeedbackBadge } from "./feedback-badge";
import { FeedbackDialog } from "./feedback-dialog";
import { ReportDialog } from "./report-dialog";

const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

type Props = { clientId: string; clientName: string; today: string; monday: string; rows: ReportRow[]; canSend: boolean; canFeedback: boolean };

function ReportActions({ r, clientId, clientName, today, canSend, canFeedback }: { r: ReportRow } & Omit<Props, "rows" | "monday">) {
  const area = REPORT_AREA_LABEL[r.area].toLowerCase();
  return (
    <div className="flex flex-wrap items-center gap-1">
      {canFeedback && (
        <FeedbackDialog
          id={r.id} clientId={clientId} clientName={clientName} area={r.area} weekOn={r.weekOn}
          initial={{ feedback: r.feedback, note: r.feedbackNote }}
          trigger={<Button size="sm" variant={r.feedback ? "outline" : "default"} aria-label={`${r.feedback ? "Corrigir o retorno" : "Registrar o retorno"} do relatório de ${area} da semana de ${br(r.weekOn)}`}>{r.feedback ? "Corrigir retorno" : "Registrar retorno"}</Button>}
        />
      )}
      {canSend && (
        <ReportDialog
          clientId={clientId} clientName={clientName} area={r.area} today={today} id={r.id}
          initial={{ sentOn: r.sentOn, link: r.link ?? "", notes: r.notes ?? "" }}
          trigger={<Button variant="ghost" size="icon" aria-label={`Corrigir o envio do relatório de ${area} da semana de ${br(r.weekOn)}`}><Pencil /></Button>}
        />
      )}
      {canSend && !r.feedback && (
        <ConfirmDialog
          trigger={<Button variant="ghost" size="icon" className="text-danger" aria-label={`Apagar o envio do relatório de ${area} da semana de ${br(r.weekOn)}`}><Trash2 /></Button>}
          title="Apagar este envio?"
          description="Use só se registrou por engano. Depois de registrar o retorno do cliente, o envio fica no histórico."
          confirmLabel="Apagar"
          onConfirm={async () => handleResult(await deleteReport({ id: r.id, clientId }))}
        />
      )}
    </div>
  );
}

function ReportDetails({ r }: { r: ReportRow }) {
  return (
    <>
      <p className="text-muted-foreground">
        Enviado em {br(r.sentOn)}{r.sentByName ? ` por ${r.sentByName}` : ""}
        {r.link && (
          <>
            {" · "}
            <a href={r.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-foreground underline-offset-4 hover:underline">
              Abrir relatório <ExternalLink className="size-3.5" aria-hidden="true" /><span className="sr-only"> (abre em nova aba)</span>
            </a>
          </>
        )}
      </p>
      {r.notes && <p className="break-words text-muted-foreground">{r.notes}</p>}
      {r.feedback && (
        <p className="break-words">
          <FeedbackBadge feedback={r.feedback} className="font-medium" />
          {r.feedbackNote && <span className="text-muted-foreground"> · {r.feedbackNote}</span>}
          {r.feedbackByName && <span className="text-muted-foreground"> ({r.feedbackByName})</span>}
        </p>
      )}
      {r.callTaskId && (
        <p><Link href={`/tarefas/${r.callTaskId}`} className="text-brand underline-offset-4 hover:underline">Ver a demanda de ligação</Link></p>
      )}
    </>
  );
}

/** Relatórios de uma área: a semana atual no topo, depois as anteriores com o retorno do cliente. */
export function AreaReports({ area, ...p }: Props & { area: ReportArea }) {
  const current = p.rows.find((r) => r.weekOn === p.monday) ?? null;
  const past = p.rows.filter((r) => r !== current);
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-sm">
        <div className="grid min-w-0 gap-1">
          <p className="font-medium">Semana de {br(p.monday)}</p>
          {current ? (
            <>
              {!current.feedback && <FeedbackBadge feedback={null} />}
              <ReportDetails r={current} />
            </>
          ) : (
            <p className="text-warning">Relatório ainda não enviado</p>
          )}
        </div>
        {current ? (
          <ReportActions r={current} {...p} />
        ) : (
          p.canSend && (
            <ReportDialog clientId={p.clientId} clientName={p.clientName} area={area} today={p.today}
              trigger={<Button size="sm" aria-label={`Registrar envio do relatório de ${REPORT_AREA_LABEL[area].toLowerCase()}`}>Registrar envio</Button>} />
          )
        )}
      </div>
      {past.length > 0 && (
        <ul className="divide-y rounded-xl border bg-card" aria-label={`Relatórios anteriores de ${REPORT_AREA_LABEL[area].toLowerCase()}`}>
          {past.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm">
              <div className="grid min-w-0 gap-1">
                <p className="flex flex-wrap items-center gap-x-3 font-medium">Semana de {br(r.weekOn)} {!r.feedback && <FeedbackBadge feedback={null} className="font-normal" />}</p>
                <ReportDetails r={r} />
              </div>
              <ReportActions r={r} {...p} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
