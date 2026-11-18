import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { reportFileName } from "@/lib/whatsapp/reports";

const UUID = /^[0-9a-f-]{36}$/i;

/** RF-REL-06: baixa o PDF de um relatório enviado. A linha é lida com o login da pessoa (a RLS decide); o arquivo, pelo servidor. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });
  const { id, fileId } = await params;
  if (!UUID.test(id) || !UUID.test(fileId)) return NextResponse.json({ error: "Relatório inválido." }, { status: 400 });
  const supabase = await createClient();
  const { data: file } = await supabase
    .from("ads_report_files")
    .select("storage_path, period_start, period_end, clients(name)")
    .eq("id", fileId)
    .eq("client_id", id)
    .maybeSingle();
  if (!file) return NextResponse.json({ error: "Relatório não encontrado." }, { status: 404 });
  const { data: blob, error } = await createAdminClient().storage.from("relatorios").download(file.storage_path);
  if (error || !blob) return NextResponse.json({ error: "O arquivo deste relatório não foi encontrado no armazenamento." }, { status: 410 });
  const client = (Array.isArray(file.clients) ? file.clients[0] : file.clients) as { name: string } | null;
  return new NextResponse(new Uint8Array(await blob.arrayBuffer()), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${reportFileName(client?.name ?? "cliente", { start: file.period_start, end: file.period_end })}"`,
      "cache-control": "private, no-store",
    },
  });
}
