# Sistema Extend — pacote de especificação e prompts

Sistema interno da **Agência Extend**: clientes, onboarding, produção de conteúdo, tráfego pago (Meta Ads e Google Ads), relatórios e alertas automáticos, WhatsApp, funil de vendas, prospecção e propostas comerciais. Os funcionários entram com login próprio e veem o que o administrador liberar.

A especificação e os prompts continuam aqui; o código da **etapa 01 (fundação)** já está em `src/` e `supabase/`.

## Rodar o sistema (desenvolvimento)

1. `npm install`
2. Preencha em `.env.local` os dados do projeto Supabase **extend-dev** (URL, publishable key, secret key e `SUPABASE_DB_URL` do Session pooler). As chaves VAPID, `JOBS_TOKEN` e `TOKEN_ENCRYPTION_KEY` já foram geradas localmente.
3. `npm run db:migrate` — aplica `supabase/migrations/*` no banco.
4. `npm run db:test` — testes pgTAP de RLS. `npm run db:types` — gera os tipos do banco.
5. `node scripts/bootstrap-admin.mjs email@extend "Nome"` — cria o primeiro administrador (o cadastro público é desligado).
6. `npm run dev` e entre em http://localhost:3000.
7. Supabase → Authentication: desligar "Allow new users to sign up"; Site URL e Redirect URLs (`/auth/confirm`, `/convite/*`); colar `supabase/templates/convite.html` no template "Invite user".
8. Depois do deploy na Vercel: `node scripts/configure-jobs.mjs https://<domínio>` para o `pg_cron` chamar `/api/jobs/*`.

Verificações: `npm run typecheck`, `npm run lint`, `npm run test` (Vitest), `npm run test:e2e` (Playwright).

## Como executar

1. Abra esta pasta no VS Code (`D:\MEU SERVIDOR\Sistema - Extend`).
2. Abra o Claude Code no terminal do VS Code. Ele lê o [CLAUDE.md](CLAUDE.md) sozinho (regras permanentes do projeto).
3. Cole o conteúdo de [prompts/00-INICIO.md](prompts/00-INICIO.md). O Claude vai ler a documentação e devolver o plano e as dúvidas, **sem codar**.
4. Responda as dúvidas, aprove o plano e siga os prompts na ordem: `01`, `02`, `03`… Um prompt por vez.
5. Ao fim de cada etapa, cole [prompts/99-REVISAO-FUNCIONAL.md](prompts/99-REVISAO-FUNCIONAL.md) para o Claude testar tudo de ponta a ponta antes de avançar.

## Ordem das etapas

| # | Prompt | Entrega | Fase |
|---|---|---|---|
| 00 | [00-INICIO](prompts/00-INICIO.md) | Leitura, plano, dúvidas | — |
| 01 | [01-FUNDACAO](prompts/01-FUNDACAO.md) | Projeto, Supabase da Extend, login por convite, papéis e permissões, layout, notificações, PWA | MVP |
| 02 | [02-CLIENTES-ONBOARDING](prompts/02-CLIENTES-ONBOARDING.md) | Fechamento comercial → cliente → onboarding obrigatório → abas e demandas geradas automaticamente | MVP |
| 03 | [03-PRODUCAO-TAREFAS](prompts/03-PRODUCAO-TAREFAS.md) | Quadros por cliente e por setor, minhas tarefas, fluxo com troca de responsável, tempo, agenda, arquivos | MVP |
| 03B | [docs/09](docs/09-comparativo-e-plano-midias.md) | Controle de Mídias: mês do cliente pelo início do contrato, campos de cada conteúdo, quadro do setor (Edição e Design), relatório de produção por pessoa | MVP |
| 04 | [04-CRIATIVOS](prompts/04-CRIATIVOS.md) | Solicitação de criativos tráfego → mídias, versões, aprovação interna e do cliente por link, biblioteca | MVP |
| 05 | [05-ANUNCIOS](prompts/05-ANUNCIOS.md) | Conexão Meta/Google, sincronização, painéis, planejamento, nomenclatura, calendário, performance por criativo | MVP |
| 06 | [06-RELATORIOS-ALERTAS](prompts/06-RELATORIOS-ALERTAS.md) | Relatórios automáticos no WhatsApp, alertas, checklists, registro de alterações, dashboards gerais | MVP |
| 07 | [07-WHATSAPP-ATENDIMENTO](prompts/07-WHATSAPP-ATENDIMENTO.md) | Inbox, conexão por QR/API oficial, criar lead pela conversa, origem do anúncio | Fase 2 |
| 08 | [08-COMERCIAL-FUNIL-PROSPECTADOR](prompts/08-COMERCIAL-FUNIL-PROSPECTADOR.md) | Leads, funis, cadências, prospectador na nuvem com score, ganho → onboarding | Fase 2 |
| 09 | [09-PROPOSTAS](prompts/09-PROPOSTAS.md) | Modelos editáveis, geração de PDF, link de aceite, envio no WhatsApp | Fase 2 |
| 10 | [10-CONTEUDO-PUBLICACAO](prompts/10-CONTEUDO-PUBLICACAO.md) | Cronograma, publicação e agendamento no Facebook/Instagram | Fase 2 |
| 11 | [11-TRAFEGO-FASE2](prompts/11-TRAFEGO-FASE2.md) | Qualidade de leads, metas, histórico de reprovações, aprovações de verba, gestão de campanhas | Fase 2 |
| 12 | [12-AREA-DO-CLIENTE](prompts/12-AREA-DO-CLIENTE.md) | Portal do cliente (somente leitura + aprovações) | Fase 3 |
| 99 | [99-REVISAO-FUNCIONAL](prompts/99-REVISAO-FUNCIONAL.md) | Teste de ponta a ponta + revisão de interface ao final de cada etapa | Sempre |

**Prazo combinado na reunião:** etapas 01–06 prontas até o fim de novembro/2026 para a equipe usar em dezembro. Fase 2 em dezembro. Implantação com clientes (fase 3) em janeiro/2027.

## Estrutura

```
CLAUDE.md                     regras permanentes para o Claude Code
docs/
  00-visao-geral.md           a agência, as dores, as pessoas, a jornada do cliente
  01-requisitos-funcionais.md todos os módulos com critérios de aceite
  02-arquitetura-e-dados.md   stack, pastas, modelo de dados, jobs
  03-permissoes.md            papéis, escopos, matriz de acesso
  04-integracoes.md           Meta, Google Ads, WhatsApp, Drive, Agenda: como configurar
  05-referencias-hubsystem.md o que reaproveitar do HubSystem e o que evitar
  06-decisoes-e-pendencias.md decisões em aberto e o que pedir à Extend
  07-identidade-visual.md     cores, fontes e logos da Extend
prompts/                      um prompt por etapa (colar no Claude Code, na ordem)
briefing/
  briefing-trafego-pago-luiz.pdf
  checklist-briefing-trafego.md
  reuniao-2026-11-10/         transcrição automática, resumo e prints da reunião
assets/brand/                 logos da Extend
```

> A transcrição da reunião foi feita automaticamente e tem muitos trechos truncados. O documento que vale é o [resumo da reunião](briefing/reuniao-2026-11-10/resumo-da-reuniao.md), que organiza o que foi dito com os horários.
