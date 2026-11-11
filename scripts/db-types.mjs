// Gera src/lib/supabase/database.types.ts a partir do banco (nunca escrever tipos à mão).
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { loadEnv, required } from "./env.mjs";

loadEnv();
const url = required("SUPABASE_DB_URL");
const out = execSync(`npx -y supabase@latest gen types typescript --db-url "${url}" --schema public`, {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
  maxBuffer: 20 * 1024 * 1024,
});
writeFileSync("src/lib/supabase/database.types.ts", out, "utf8");
console.log("Tipos gerados em src/lib/supabase/database.types.ts");
