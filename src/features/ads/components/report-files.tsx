import Link from "next/link";
import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { formatDateTime } from "@/domain/shared/dates";
import type { ReportFile } from "@/features/ads/report-queries";

const KIND: Record<string, string> = { diario: "Diário", semanal: "Semanal", mensal: "Mensal", avulso: "Enviado pelo botão" };
const full = (d: string) => d.split("-").reverse().join("/");
const kb = (n: number) => `${Math.max(1, Math.round(n / 1024)).toLocaleString("pt-BR")} KB`;

/** PDFs dos relatórios de anúncios enviados ao grupo (RF-REL-06), para baixar e reenviar ao cliente. */
export function ReportFiles({ clientId, files }: { clientId: string; files: ReportFile[] }) {
  if (!files.length) {
    return (
      <p className="rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground">
        Nenhum relatório de anúncios enviado ainda. Cada envio (pelo botão Relatório na{" "}
        <Link href={`/clientes/${clientId}/anuncios`} className="font-medium text-foreground underline underline-offset-2">aba Anúncios</Link>{" "}
        ou o automático) guarda o PDF aqui.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Período</th>
            <th scope="col" className="px-3 py-2 font-medium">Tipo</th>
            <th scope="col" className="hidden px-3 py-2 font-medium sm:table-cell">Enviado em</th>
            <th scope="col" className="px-3 py-2"><span className="sr-only">Baixar</span></th>
          </tr>
        </thead>
        <tbody>
          {files.map((f) => {
            const period = f.start === f.end ? full(f.start) : `${full(f.start)} a ${full(f.end)}`;
            return (
              <tr key={f.id} className="border-t">
                <td className="px-3 py-2 font-medium tabular-nums">{period}</td>
                <td className="px-3 py-2">{KIND[f.frequency] ?? f.frequency}</td>
                <td className="hidden px-3 py-2 text-muted-foreground sm:table-cell">
                  {formatDateTime(f.sentAt)}{f.sentByName ? ` · ${f.sentByName}` : " · automático"}
                </td>
                <td className="px-3 py-2 text-right">
                  <a href={`/clientes/${clientId}/relatorios/pdf/${f.id}`} download className={buttonVariants({ variant: "outline", size: "sm" })} aria-label={`Baixar o PDF do relatório de ${period} (${kb(f.sizeBytes)})`}>
                    <Download aria-hidden="true" /> PDF
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
