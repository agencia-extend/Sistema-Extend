import { createJiti } from "jiti";
import { fileURLToPath } from "node:url";
process.loadEnvFile(".env.local");
const src = fileURLToPath(new URL("../src", import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": src, "server-only": fileURLToPath(new URL("../node_modules/server-only/empty.js", import.meta.url)) } });
const { syncMetaAccount } = await jiti.import("../src/lib/ads/meta-sync.ts");
const { accessToken, getConnection } = await jiti.import("../src/lib/integrations/store.ts");
const { createAdminClient } = await jiti.import("../src/lib/supabase/admin.ts");
const db = createAdminClient();
const { data: accs } = await db.from("ad_accounts").select("id, external_id, connection_id, synced_at, organization_id, client_id, name").in("name", process.argv.slice(2));
for (const acc of accs) {
  const conn = await getConnection(acc.connection_id);
  const t0 = Date.now();
  try {
    const r = await syncMetaAccount(acc, await accessToken(conn));
    console.log(acc.name, JSON.stringify(r), `${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } catch (e) { console.log(acc.name, "ERRO:", e.message); }
}
