import postgres from "postgres";
process.loadEnvFile(".env.local");
const sql = postgres(process.env.SUPABASE_DB_URL, { max: 1 });
for (const t of ["tasks","workflows","workflow_steps","boards","board_columns","calendar_events","client_meetings","client_ideas","clients","client_services","service_catalog"]) {
  const c = await sql`select column_name, data_type, is_nullable, column_default is not null as d from information_schema.columns where table_schema='public' and table_name=${t} order by ordinal_position`;
  console.log("\n"+t+": "+c.map(r=>`${r.column_name}:${r.data_type.replace("timestamp with time zone","tstz").replace("character varying","vc")}${r.is_nullable==="NO"&&!r.d?"!":""}`).join(", "));
}
console.log(await sql`select w.type, w.name, string_agg(s.name, ' > ' order by s.position) from public.workflows w join public.workflow_steps s on s.workflow_id=w.id group by 1,2`);
console.log(await sql`select key,name,sector_id is not null as sec, has_monthly_qty from public.service_catalog`.catch(e=>e.message));
await sql.end();
