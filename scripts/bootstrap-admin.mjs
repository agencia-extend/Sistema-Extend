// Cria o PRIMEIRO administrador (o cadastro público é desligado).
//   node scripts/bootstrap-admin.mjs email@extend.com "Nome Completo"
// Gera uma senha temporária forte e imprime uma única vez; troque no primeiro acesso.
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { loadEnv, required } from "./env.mjs";

loadEnv();
const [email, ...nameParts] = process.argv.slice(2);
if (!email || !nameParts.length) {
  console.error('Uso: node scripts/bootstrap-admin.mjs email@dominio.com "Nome Completo"');
  process.exit(1);
}
const admin = createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SECRET_KEY"), {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { count } = await admin.from("profiles").select("id", { count: "exact", head: true });
if (count) {
  console.error("Já existem usuários. Convide novas pessoas pela tela Configurações → Usuários.");
  process.exit(1);
}
const password = randomBytes(12).toString("base64url") + "9a";
const { error } = await admin.auth.admin.createUser({
  email: email.toLowerCase(),
  password,
  email_confirm: true,
  user_metadata: { full_name: nameParts.join(" ") },
});
if (error) {
  console.error("Erro:", error.message);
  process.exit(1);
}
console.log(`Administrador criado: ${email}\nSenha temporária: ${password}\nEntre e troque a senha em Configurações → Meu perfil.`);
