# 05 — Referências do HubSystem

Projeto: `D:\MEU SERVIDOR\HubSystem - Sistema` (somente leitura — **nunca altere arquivos de lá**). Mesmo desenvolvedor, mesma stack. Leia antes de implementar o módulo correspondente e adapte ao domínio da Extend.

Documentos úteis: `README.md`, `docs/fase-0-arquitetura.md`, `docs/integracoes.md`, `docs/adr/README.md`.

## O que reaproveitar (ler e adaptar)
| Tema | Onde olhar | Usar na etapa |
|---|---|---|
| Server Actions padronizadas | `src/lib/actions.ts` (`defineAction`) | 01 |
| Sessão e permissão no servidor | `src/lib/auth/dal.ts`, `src/proxy.ts`, `src/lib/supabase/{server,client,admin}.ts` | 01 |
| Catálogo de permissões | `src/domain/permissions/index.ts` | 01 |
| RLS com escopo, overrides, trava de autoelevação | migrations de fundação (`20261031000100_foundation`…), `20261105090000_access_escalation_guard`, testes `supabase/tests/database/*` | 01 |
| Convite com token hash, rate limit | `src/app/(auth)/convite/[token]`, `src/lib/rate-limit.ts`, `supabase/templates/convite.html` | 01 |
| Notificações + Web Push + relógio no banco | `features/notifications/*`, `/api/push/dispatch`, `private.notifications_tick`, `cron.schedule(...)` nas migrations | 01 |
| Menu filtrado por permissão | `src/config/navigation.ts` | 01 |
| Cifra de tokens | `src/lib/crypto.ts` (AES-256-GCM) | 05 |
| Tarefas, quadros, colunas, checklist, comentários | `features/tasks/*`, tabelas `tasks`, `task_boards`, `task_columns`… | 03 |
| Agenda + Google Agenda | `src/lib/google/calendar.ts`, `calendar_events` | 03 |
| Aprovação por link público | `task_deliveries*`, `src/app/aprovar/[token]`, `src/app/aprovar/entrega/[token]` | 04 |
| OAuth Meta/Google com `state` | `src/lib/ads/oauth.ts` | 05 |
| Clientes Meta e Google Ads | `src/lib/ads/meta.ts`, `src/lib/ads/google-ads.ts`, `src/lib/ads/tokens.ts` | 05 |
| Sync idempotente (90 → 7 dias, upsert em lotes) | `src/lib/ads/sync.ts` | 05 |
| Soma de conversões | `src/domain/ads/conversions.ts` | 05 |
| UTMs | `src/domain/ads/utm.ts` | 05 |
| Relatórios para grupo do WhatsApp + modelos com variáveis | `src/lib/ads/reports.ts`, `src/domain/ads/report-message.ts`, `features/ads/components/reports-panel.tsx`, tabela `ads_report_settings` | 06 |
| Alertas com deduplicação diária | `src/lib/ads/alerts.ts`, RPC `notify_users` | 06 |
| WhatsApp WAHA e Cloud API | `src/lib/waha.ts`, `src/lib/whatsapp.ts`, `infra/waha`, `features/inbox/*` | 06/07 |
| Origem Clique-para-WhatsApp | `ad_referrals`, webhook do WhatsApp | 07 |
| CRM: leads/deals/pipelines/stages, importador com desfazer, cadências | migration `20261031000300_crm.sql`, `features/crm/*`, `src/lib/cadence-runner.ts`, `domain/crm/opt-out.ts` | 08 |
| Publicação Facebook/Instagram | `src/lib/content-publisher.ts` | 10 |

## O que NÃO repetir
1. **Sync de anúncios num laço único** dentro de uma função serverless → usar fila com um job por conta.
2. **`login-customer-id` do Google num `Map` em memória** → persistir por conta.
3. **Escopos da Meta inconsistentes** (doc diz leitura, código pede gestão) → pedir só o necessário em cada etapa.
4. **Token Meta de 60 dias sem renovação** → System User token + aviso antecipado.
5. **Prospectador dependente de Docker no PC do dono e sem score** → Google Places na nuvem com score.
6. **Tipos do banco escritos à mão e `as unknown as`** → `supabase gen types`.
7. **Componentes de 600–900 linhas** → quebrar.
8. **Migrations aplicadas escondidas dentro do build** → comando explícito.
9. **Problemas de encoding** → UTF-8 desde a primeira migration, testes com acentuação.
10. **Sem observabilidade** → Sentry desde a etapa 01.
11. **Módulos fora do escopo** (financeiro pessoal, Stripe, avaliações Google, versículo/clima) → não trazer.
12. **Não existe módulo de propostas** no HubSystem → construir do zero (etapa 09).
