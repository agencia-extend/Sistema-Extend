# Prompt 08 — Comercial: leads, funil de vendas, cadências e prospectador

**Objetivo:** o comercial da Extend (Jorge) controla leads e negócios num funil, encontra novos clientes com o prospectador e, ao fechar, dispara o onboarding sem mandar nada por grupo.

**Leia antes:** `docs/01-requisitos-funcionais.md` seções **CRM** e **RF-FEC-04**; decisão D8; no HubSystem: migration `20261031000300_crm.sql`, `features/crm/*` (board, import-wizard), `src/lib/cadence-runner.ts`, `src/domain/crm/{opt-out,prospector}.ts`, `docs/prospectador-local.md` (só para entender a ideia — **não** reproduzir a dependência de Docker local).

**Primeiro me mostre o plano** e espere meu ok.

## Escopo
1. **Leads (RF-CRM-01, 03):** cadastro, origem e UTMs, deduplicação por telefone/e-mail, timeline de atividades, próximas ações com lembrete, vínculo com conversas do WhatsApp.
2. **Funis (RF-CRM-02):** configuráveis; Kanban com arrastar; etapa com SLA (destaca parados); perda com motivo obrigatório; histórico de etapas por trigger.
3. **Importação (RF-CRM-04)** com mapeamento, prévia, deduplicação e desfazer.
4. **Ganho → fechamento (RF-CRM-05):** mover para Ganho abre o formulário de fechamento da etapa 02 pré-preenchido → cria o cliente em onboarding.
5. **Cadências (RF-CRM-06):** passos (tarefa ou mensagem WhatsApp agendada com modelo), pausa quando o lead responde, opt-out ("parar", "sair"), horário comercial.
6. **Prospectador (RF-CRM-07):** busca por nicho(s) + cidade/UF na Google Places API (da Extend), paginação, resultados com nome, telefone, site, endereço, nota, nº de avaliações, link do Maps; enriquecimento de redes sociais quando o site tiver; **score configurável** (pesos por critério) com explicação do score; selecionar e importar para um funil sem duplicar; controle de custo (consultas no mês e teto).
7. **Dashboard comercial (RF-CRM-08).**

## Roteiro de teste (obrigatório)
1. Importar uma planilha com 30 leads (5 duplicados) → 25 importados; desfazer → somem.
2. Criar lead, mover pelo funil, perder sem motivo → bloqueado; com motivo → ok.
3. Inscrever um lead numa cadência → tarefa criada e mensagem agendada sai no horário; o lead responde → cadência pausa; responde "parar" → opt-out.
4. Prospectar "imobiliária" em uma cidade real → resultados com score e explicação; importar 3 → entram no funil; repetir a busca → marcados como já importados.
5. Mover um negócio para Ganho → formulário de fechamento pré-preenchido → cliente em onboarding e Jacque/Luiz notificados.
6. Usuário sem `crm.read` não vê nada do comercial.

Ao terminar, rode `prompts/99-REVISAO-FUNCIONAL.md`.
