import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Cópia dos dados pessoais de quem está logado, em JSON (acesso e portabilidade, art. 18 da LGPD). */
export async function GET() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ error: "Entre no sistema para baixar seus dados." }, { status: 401 });

  const { data, error } = await supabase.rpc("my_personal_data");
  if (error || !data) {
    console.error("[meus-dados]", error?.code);
    return NextResponse.json({ error: "Não foi possível gerar a cópia agora. Tente novamente." }, { status: 500 });
  }
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="meus-dados-extend-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
