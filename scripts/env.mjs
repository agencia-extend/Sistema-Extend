import { readFileSync, existsSync } from "node:fs";

/** Carrega .env.local/.env para scripts de linha de comando (sem sobrescrever o ambiente). */
export function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

export function required(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Defina ${name} em .env.local.`);
    process.exit(1);
  }
  return v;
}
