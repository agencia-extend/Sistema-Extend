import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeFileName, SERVABLE_MIME } from "@/domain/whatsapp/media";

// Foto, áudio, vídeo ou documento de uma mensagem do Atendimento. Só para quem vê a conversa: a mensagem é lida
// com o login da pessoa (a RLS decide) e só então o arquivo sai do armazenamento privado.
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user?.permissions["inbox.read"]) return new NextResponse("Sem acesso.", { status: 403 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Arquivo inválido.", { status: 400 });

  const supabase = await createClient();
  const { data: msg } = await supabase.from("whatsapp_messages").select("media_path, media_mime, media_name").eq("id", id).maybeSingle();
  if (!msg?.media_path) return new NextResponse("Arquivo não encontrado.", { status: 404 });
  const mime = msg.media_mime ?? "application/octet-stream";
  if (!SERVABLE_MIME.test(mime)) return new NextResponse("Tipo de arquivo não permitido.", { status: 415 });
  const { data, error } = await createAdminClient().storage.from("whatsapp-midia").download(msg.media_path);
  if (error || !data) return new NextResponse("O arquivo não está mais disponível.", { status: 410 });
  const inline = /^(image|audio|video)\//.test(mime);
  return new NextResponse(data, {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(safeFileName(msg.media_name))}`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
