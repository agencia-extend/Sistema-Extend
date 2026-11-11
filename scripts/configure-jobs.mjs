// Grava no banco a URL do site e o token dos jobs para o pg_cron chamar /api/jobs/*.
//   node scripts/configure-jobs.mjs https://sistema.agenciaextend.com.br
import postgres from "postgres";
import { loadEnv, required } from "./env.mjs";

loadEnv();
const siteUrl = process.argv[2] ?? required("NEXT_PUBLIC_SITE_URL");
if (!siteUrl.startsWith("https://")) {
  console.error("O pg_cron precisa de uma URL pública https (ex.: o domínio da Vercel).");
  process.exit(1);
}
const sql = postgres(required("SUPABASE_DB_URL"), { ssl: "require", max: 1 });
const token = required("JOBS_TOKEN");
await sql`insert into private.app_settings (key, value) values ('site_url', ${siteUrl}), ('jobs_token', ${token})
          on conflict (key) do update set value = excluded.value, updated_at = now()`;
await sql.end();
console.log(`Jobs configurados para ${siteUrl}.`);
