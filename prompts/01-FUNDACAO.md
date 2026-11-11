# Prompt 01 — Fundação

**Objetivo:** projeto rodando no Supabase e na Vercel **da Extend**, com login por convite, papéis e permissões aplicados no banco, layout do app, notificações com push e PWA. É a base de todas as outras etapas.

**Leia antes:** `CLAUDE.md`, `docs/02-arquitetura-e-dados.md`, `docs/03-permissoes.md`, `docs/04-integracoes.md` (Supabase, Vercel, Web Push), `docs/07-identidade-visual.md`, e no HubSystem: `src/lib/actions.ts`, `src/lib/auth/dal.ts`, `src/proxy.ts`, `src/lib/supabase/*`, `src/domain/permissions/index.ts`, as migrations de fundação, `20261105090000_access_escalation_guard`, `src/config/navigation.ts`, `features/notifications/*`.

**Primeiro me mostre o plano** (tabelas, funções RLS, telas, catálogo de permissões) e espere meu ok.

## Escopo
1. **Projeto:** Next.js 16 + TS estrito + Tailwind 4 + shadcn/ui + ESLint/Prettier + Vitest + Playwright + Sentry. Scripts `dev`, `build`, `typecheck`, `lint`, `test`, `test:e2e`, `db:migrate`, `db:types`, `db:test`. `.env.example` com os nomes de `docs/02`. Git inicializado com `.gitignore` correto.
2. **Supabase** (`extend-dev`): migrations de fundação — `organizations`, `profiles`, `sectors` (seed: Administrativo, Comercial, Tráfego, Conteúdo, Gerenciamento, Edição de vídeo, Design, Gravação, Sites), `profile_sectors`, `permissions` (catálogo completo de `docs/03`, inclusive o que só será usado em etapas futuras), `roles` (seed dos papéis de `docs/03`), `role_permissions`, `user_roles`, `user_permission_overrides`, `invitations`, `audit_logs` (trigger genérico), `notifications`, `notification_preferences`, `push_subscriptions`, `private.app_settings`, `private.rate_limits`. Funções `private.*` de `docs/02#seguranca`. Trava de autoelevação.
3. **Auth (RF-PER-01, 02, 10):** login, recuperar senha, definir senha, aceitar convite, manter conectado, sair. Cadastro público desligado. Rate limit no login e no convite. Desativar usuário.
4. **Administração (RF-PER-03..09):** telas Usuários (convidar, editar papel/setores, desativar, reenviar/revogar convite, "Ver como"), Papéis (matriz de permissões com escopo, duplicar papel, comparar), Setores, Auditoria (filtro por usuário, tabela, período; antes/depois).
5. **Layout:** barra lateral com menu filtrado por permissão (`config/navigation.ts`), cabeçalho com busca global (cmdk, por enquanto usuários e páginas), sino de notificações, menu do usuário, tema claro/escuro, identidade da Extend. Navegação inferior no celular. Página Início com "Minhas pendências" (vazia com orientação até a etapa 03).
6. **Notificações (RF-NOT-01..04):** central, marcar lida, preferências por tipo, Web Push (VAPID, service worker, botão "ativar notificações neste aparelho"), relógio `pg_cron` + rota `api/jobs/notifications` protegida por token. Função `notify(users, kind, title, link, dedupe_key)` reutilizável.
7. **PWA:** manifest com logo da Extend, ícones 192/512, instalável no Android e iOS, tela offline simples.
8. **Deploy:** projeto na Vercel da Extend apontando para o `extend-dev` (preview) — produção só quando eu liberar.

## Roteiro de teste (obrigatório)
1. Admin entra, convida "Editor Teste" com papel Editor de vídeo e setor Edição.
2. Editor abre o convite, define a senha, entra; vê só os itens de menu permitidos; tenta acessar `/configuracoes/usuarios` pela URL → bloqueado.
3. Consulta direta ao Supabase com o token do editor em `roles`/`user_roles` de outros → nada retorna/nega escrita (teste pgTAP + e2e).
4. Admin dá ao editor uma permissão extra por override → efeito imediato; remove → some.
5. Editor tenta se dar permissão (chamada direta à action/RPC) → negado.
6. Admin usa "Ver como" o editor → vê exatamente o menu do editor.
7. Admin dispara notificação de teste → aparece no sino do editor e como push no celular (PWA instalado).
8. Admin desativa o editor → sessão dele cai e não consegue entrar.
9. Auditoria mostra todas as ações acima.

## Fora do escopo
Clientes, tarefas e integrações (próximas etapas).

Ao terminar, rode `prompts/99-REVISAO-FUNCIONAL.md`.
