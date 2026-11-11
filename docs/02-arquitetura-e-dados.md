# 02 — Arquitetura e modelo de dados

## Stack
| Camada | Escolha |
|---|---|
| App | Next.js 16 (App Router, Turbopack), React 19, TypeScript estrito. Middleware = `src/proxy.ts`. |
| UI | Tailwind CSS 4, shadcn/ui, lucide-react, sonner, cmdk, next-themes, dnd-kit, Recharts |
| Formulários | React Hook Form + Zod |
| Banco/Auth | Supabase **da Extend** (Postgres 17, sa-east-1): Auth, RLS, Realtime, Storage, `pg_cron`, `pg_net`, `pgmq` |
| Hospedagem | Vercel da Extend (região gru1) |
| Testes | Vitest (domínio), pgTAP (RLS), Playwright (ponta a ponta) |
| Observabilidade | Sentry + logs estruturados nas rotas de integração |
| PDF | `@react-pdf/renderer` (relatórios e propostas) |
| PWA | `app/manifest.ts`, service worker, Web Push (VAPID) |

## Pastas
```
src/
  app/(auth)/          login, recuperar-senha, definir-senha, convite/[token]
  app/(app)/           inicio, minhas-tarefas, clientes/[id]/*, setores/[setor], criativos, anuncios/*,
                       relatorios, alertas, agenda, atendimento, comercial/*, propostas, conteudo,
                       dashboards, configuracoes/*
  app/(public)/        aprovar/[token], proposta/[token], avaliar-leads/[token]
  app/api/             integracoes (oauth callbacks), webhooks (whatsapp, meta), jobs/[job] (chamado pelo pg_cron)
  domain/              regras puras + testes (metricas, nomenclatura, slots, permissoes, fadiga, templates)
  features/<modulo>/   actions.ts, queries.ts, schemas.ts, components/
  lib/                 supabase/, auth/dal.ts, actions.ts (defineAction), crypto.ts, ads/, whatsapp/, google/, drive/, push/, pdf/
  config/navigation.ts menu filtrado por permissão
supabase/migrations, supabase/tests, supabase/seed.sql
e2e/                   testes Playwright por etapa
```

## Jobs e filas
- **Relógio do banco:** `pg_cron` chama rotas `app/api/jobs/[job]` via `pg_net` com token guardado em `private.app_settings` (evita o limite de cron da Vercel).
  - a cada 1 min: notificações e push pendentes; fila do WhatsApp.
  - a cada 15 min: alertas de anúncios; relatórios agendados (janela de 15 min).
  - a cada 3 h: enfileirar sincronização de cada conta de anúncio.
  - diário 00:10: slots do mês (no dia 1º), prazos/atrasos, promessas comerciais, contratos vencendo.
- **Fila (`pgmq`)**: um job por conta de anúncio, com retry exponencial e registro de falha. Nada de sincronizar todas as contas num laço único.

## Modelo de dados (resumo — detalhar no plano de cada etapa)
**Fundação:** `organizations`, `profiles`, `sectors`, `profile_sectors`, `roles`, `permissions`, `role_permissions`, `user_roles`, `user_permission_overrides`, `invitations`, `audit_logs`, `notifications`, `notification_preferences`, `push_subscriptions`, `private.app_settings`, `private.rate_limits`.

**Clientes:** `clients`, `service_catalog`, `client_services` (serviço, qtd_mensal, início, fim), `client_members` (perfil, setor/função, padrão_para_tipo), `client_accounts` (tipo: bm, ad_account_meta, ad_account_google, page, instagram, pixel, whatsapp, site, drive_folder; valor), `client_contacts`, `commercial_handoffs` (+ `handoff_promises`, anexos), `onboarding_forms` (modelo de perguntas, versionado), `client_onboarding` (respostas jsonb, completed_at), `onboarding_checklist_items`, `client_meetings` (+ participantes, anexos), `client_ideas`, `client_timeline` (eventos).

**Produção:** `boards` (cliente ou setor, modelo), `board_columns`, `workflows` + `workflow_steps` (etapa → setor/responsável padrão), `tasks` (cliente, tipo, setor, etapa, slot_mes, slot_index, prazo, prioridade, criativo_id, lead_id), `task_assignees`, `task_participants`, `task_checklist_items`, `task_comments`, `task_attachments`, `task_stage_history` (entrou_em, saiu_em, responsável), `task_time_entries`, `tags`, `task_tags`, `calendar_events` (+ attendees, setor), `google_calendar_connections`, `drive_files`.

**Criativos:** `creative_requests` (formulário), `creative_versions` (+ arquivos), `creative_reviews` (interna/cliente, decisão, comentário, ip), `approval_links` (token hash, expira), `creatives` (biblioteca: cliente, campanha, formato, ângulo, copy, status), `creative_ads` (vínculo criativo ↔ anúncio da API).

**Anúncios:** `integration_connections` (tokens cifrados, sem grant para usuários), `ad_accounts` (client_id, plataforma, login_customer_id **persistido**, saldo, limites de alerta), `ad_campaigns`, `ad_sets`, `ads` (effective_status, review_feedback, creative preview), `ad_insights_daily` e `ad_insights_ad_daily` (impressões, alcance, cliques, cliques no link, gasto_cents, leads, conversas, compras, valor_conversao_cents, video_3s, thruplays), `campaign_plans`, `naming_conventions`, `marketing_calendar_events`, `utm_links`, `optimization_checklists` (+ itens), `change_logs`, `ads_report_settings`, `ads_report_templates`, `ads_report_log`, `alert_rules`, `alerts`.

**Fase 2:** `whatsapp_numbers`, `conversations`, `messages`, `quick_replies`, `ad_referrals`; `leads`, `pipelines`, `stages`, `deals`, `deal_stage_history`, `activities`, `lead_tags`, `lost_reasons`, `imports`, `cadences*`, `prospect_searches`, `prospect_results`; `proposal_templates`, `proposal_blocks`, `proposals`, `proposal_items`, `proposal_views`; `social_accounts`, `content_posts`, `content_schedules`; `lead_quality_ratings`, `client_goals`, `budget_approvals`.

Convenções: `id uuid`, `organization_id` em toda tabela de negócio, `created_at/updated_at/created_by`, soft delete (`deleted_at`) em entidades principais, dinheiro `bigint` em centavos, enums como `text` + `check`.

## Segurança (RLS)
- RLS em todas as tabelas; nenhuma política `using (true)`.
- Funções `security definer` no schema `private` com `search_path = ''`: `org_id()`, `has_perm(perm)`, `perm_scope(perm)`, `is_client_member(client_id)`, `can_read_client(client_id)`, `can_read_task(task_id)`, `can_read_ad_account(id)`.
- Padrão: `organization_id = (select private.org_id()) and (scope = 'all' or (scope = 'clients' and private.is_client_member(client_id)) or (scope = 'own' and responsável = auth.uid()))`.
- Dados de integração escritos só pela service role. Tokens sem grant algum; leitura do status por RPC.
- Páginas públicas (`aprovar`, `proposta`, `avaliar-leads`) acessam via RPC `security definer` com token (hash), nunca com a chave secreta no cliente.
- Testes pgTAP para cada tabela × papel.

<a id="metricas"></a>
## Métricas (implementar em `src/domain/ads/metrics.ts` com testes)
| Métrica | Fórmula |
|---|---|
| CPM | gasto / impressões × 1000 |
| CTR (link) | cliques no link / impressões |
| CPC (link) | gasto / cliques no link |
| Frequência | impressões / alcance |
| CPL | gasto / leads (`lead`, `onsite_conversion.lead_grouped`, `offsite_conversion.fb_pixel_lead`) |
| Custo por conversa | gasto / `onsite_conversion.messaging_conversation_started_7d` |
| ROAS | valor de conversão / gasto |
| CPA | gasto / compras |
| Hook rate | reproduções de 3 s (`video_view`) / impressões |
| Hold rate | ThruPlays / reproduções de 3 s |
| Dias de saldo | saldo disponível / média de gasto diário (7 dias) |
| Fadiga | frequência 7d ≥ 3,0 **e** CTR 3d ≤ 0,75 × CTR dos 7d anteriores |

Divisões por zero retornam "—", nunca `NaN`/`Infinity`.

## Nomenclatura padrão sugerida **[CONFIRMAR com o Luiz]**
- Campanha: `CLIENTE_OBJETIVO_PUBLICO_AAAA-MM` (ex.: `GWP_LEADS_FRIO_2026-11`)
- Conjunto: `PUBLICO_POSICIONAMENTO_IDADE` (ex.: `INTERESSE-IMOVEIS_FEED-STORIES_25-55`)
- Anúncio: `FORMATO_ANGULO_V#` (ex.: `VIDEO_DOR-ALUGUEL_V2`)
O verificador usa expressões regulares geradas a partir do padrão salvo em `naming_conventions`.

## Ambientes e variáveis (só nomes — valores nas contas da Extend)
Públicas: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
Servidor: `SUPABASE_SECRET_KEY`, `TOKEN_ENCRYPTION_KEY`, `JOBS_TOKEN`, `META_APP_ID`, `META_APP_SECRET`, `META_LOGIN_CONFIG_ID`, `META_GRAPH_VERSION`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_ADS_DEVELOPER_TOKEN` (se ainda exigido), `GOOGLE_ADS_LOGIN_CUSTOMER_ID`, `GOOGLE_PLACES_API_KEY`, `WAHA_URL`, `WAHA_API_KEY`, `WHATSAPP_VERIFY_TOKEN`, `VAPID_PRIVATE_KEY`, `SENTRY_DSN`.
