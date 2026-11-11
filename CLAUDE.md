# CLAUDE.md — Sistema Extend

Você está construindo o sistema interno da **Agência Extend**. Antes de qualquer tarefa, conheça o contexto em `docs/00-visao-geral.md` e os requisitos do módulo em `docs/01-requisitos-funcionais.md`. A ordem de construção está em `README.md` e em `prompts/`.

## Regra nº 1: tudo funcional

O sistema vai ser usado no dia a dia por uma agência real. Uma etapa só está pronta quando **tudo o que aparece na tela funciona com dados reais**.

- **Nada de mock, dado fictício ou "em breve"** no caminho do usuário. Se um botão aparece, ele faz o que diz. Se algo ainda não existe, não aparece.
- Todo formulário valida (Zod no cliente e no servidor), salva no banco, mostra erro legível em português e confirma o sucesso.
- Toda lista tem estado vazio útil (o que fazer para preencher), carregamento e erro.
- Toda regra de acesso vale **no banco (RLS)**, não só escondendo botão.
- Toda ação que afeta outra pessoa gera notificação (no sistema + push).
- Toda integração externa tem tratamento de falha visível (conexão expirada, limite de API, erro de rede) e não quebra a tela.
- Cada etapa termina com o **roteiro de teste de ponta a ponta** do prompt da etapa executado de verdade (Playwright no navegador + dados reais no Supabase de desenvolvimento) e com o relato do que foi testado.
- Se um requisito não puder ser feito como especificado (limite de API, custo, ambiguidade), **pare e pergunte**. Não entregue uma versão simulada.

## Infraestrutura

- Tudo nas contas **da Extend**: Supabase, Vercel, app da Meta, Google Cloud/Google Ads, WhatsApp, Drive. Nada vinculado a contas pessoais do desenvolvedor.
- Segredos só em variáveis de ambiente (`.env.local` fora do git; `.env.example` só com os nomes). Nunca comitar chave, token ou senha. Tokens de terceiros ficam cifrados no banco (AES-256-GCM).
- Dois projetos Supabase: `extend-dev` (desenvolvimento e testes) e `extend-prod`. Migrations versionadas em `supabase/migrations`, aplicadas por comando explícito.

## Stack (ver `docs/02-arquitetura-e-dados.md`)

Next.js 16 (App Router; o middleware se chama `proxy.ts`), React 19, TypeScript estrito, Tailwind CSS 4, shadcn/ui, React Hook Form + Zod, dnd-kit, Recharts, Supabase (Postgres + Auth + Realtime + Storage + pg_cron/pg_net/pgmq), Vercel, Vitest, pgTAP, Playwright, Sentry.

Padrões:
- Leitura em Server Components com o JWT do usuário (a RLS filtra). Escrita por Server Actions envoltas em `defineAction` (Zod + sessão + permissão + `ActionResult`).
- Regras de negócio puras em `src/domain/**` com testes Vitest. Integrações server-only em `src/lib/**`. Módulos em `src/features/<modulo>/{actions,queries,schemas,components}`.
- Tipos do banco gerados com `supabase gen types` (nunca à mão).
- Componentes de até ~300 linhas; quebre os maiores.
- Dinheiro em centavos (`bigint`), datas em `timestamptz` exibidas em `America/Sao_Paulo`, UTF-8 em tudo.

## Referência de código

O sistema **HubSystem** (`D:\MEU SERVIDOR\HubSystem - Sistema`) é do mesmo desenvolvedor e já resolve vários problemas (permissões com RLS, anúncios Meta/Google, relatórios no WhatsApp, aprovação por link, WhatsApp, CRM). Use-o como **referência**: leia os arquivos indicados em `docs/05-referencias-hubsystem.md`, entenda e adapte. Não copie a pasta inteira e não traga módulos que a Extend não usa. Esse projeto é só leitura: nunca altere arquivos dele.

## Interface

- Antes de criar ou redesenhar telas, carregue a skill `frontend-design`. Ao terminar cada etapa, rode a skill `web-design-guidelines` e corrija o que ela apontar.
- Identidade visual em `docs/07-identidade-visual.md` (logos em `assets/brand/`).
- Português do Brasil em toda a interface. Mobile-first: a equipe usa no celular (PWA instalável com push).
- Telas enxutas: gestores de tráfego preferem tabela a dashboard cheio de gráficos.

## Forma de trabalhar

1. Antes de codar cada etapa, apresente o plano (tabelas, telas, permissões, jobs) e espere aprovação.
2. Construa em fatias verticais (banco → ação → tela → teste) e rode os testes a cada fatia.
3. Ao terminar, rode `prompts/99-REVISAO-FUNCIONAL.md` e relate: o que foi feito, o que foi testado e como, o que ficou pendente e por quê.
4. Mantenha `docs/` atualizado quando uma decisão mudar o que está escrito.
5. Commits pequenos e descritivos em português.
