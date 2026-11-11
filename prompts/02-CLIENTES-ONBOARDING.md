# Prompt 02 — Clientes, fechamento comercial e onboarding

**Objetivo:** o cliente vira o pilar do sistema. O comercial registra o fechamento → nasce o cliente em onboarding → a equipe completa a ficha e o checklist (obrigatório) → ao concluir, o sistema libera as abas certas, dá acesso às pessoas marcadas e gera as demandas do mês.

**Leia antes:** `docs/00-visao-geral.md` (jornada e fluxograma), `docs/01-requisitos-funcionais.md` seções **CLI, FEC, ONB**, `briefing/checklist-briefing-trafego.md` (itens 1 e 2), `briefing/reuniao-2026-11-10/resumo-da-reuniao.md` seções 3, 4 e 7.

**Primeiro me mostre o plano** e espere meu ok. Na proposta, inclua o formulário de onboarding como **modelo editável pelo admin** (perguntas, tipo de campo, obrigatório, seção, quem vê), já semeado com as seções do RF-ONB-01.

## Escopo
1. **Catálogo de serviços** (admin): nome, setor responsável, unidade mensal (vídeos, artes, posts, gravações, nenhuma), tipo de quadro/fluxo que gera, abas que libera. Seed: Facebook/Instagram Ads, Google Ads, Treinamento comercial, Pacote de vídeos, Conteúdo mensal, Gerenciamento de redes, Site.
2. **Fechamento comercial (RF-FEC-01..03):** formulário completo com anexos e promessas com prazo; cria o cliente em `onboarding`, o checklist e notifica os responsáveis de onboarding (configurável em Configurações).
3. **Cadastro de cliente (RF-CLI-01..04):** dados, serviços com quantidade e vigência, contas (BM, conta de anúncio Meta/Google, página, Instagram, pixel, WhatsApp, site, Drive), contatos, **responsáveis por setor** (marcar pessoa = acesso ao cliente via `client_members` + RLS).
4. **Onboarding (RF-ONB-01..07):** ficha em seções com salvamento automático e indicador de progresso; checklist com responsável e prazo por item; bloqueio das abas até concluir; "Concluir onboarding" valida tudo; ao concluir aplica a estrutura (abas, acessos, slots do mês). Job diário que gera os slots no dia 1º (idempotente). Alteração de serviços ajusta a partir do mês seguinte. Resumo operacional para quem não vê a ficha completa.

   > Os **slots** são registros de demanda do mês (`tasks` com `slot_mes` e `slot_index`). Crie agora a tabela `tasks` mínima e o quadro padrão por serviço o suficiente para os slots existirem e aparecerem numa lista simples na aba "Demanda do mês"; o Kanban completo vem na etapa 03.
5. **Visão de clientes (RF-CLI-05):** cards com progresso, status, serviços, responsáveis, atrasos; filtros e busca; respeita a visibilidade.
6. **Ambiente do cliente (RF-CLI-06..09):** abas condicionais; Visão geral com timeline; Reuniões (timeline com anexos, agendar reunião); Ideias e referências; Arquivos (anexos no Storage privado, por enquanto); Histórico.
7. **Importação (RF-CLI-10):** importar a planilha "Controle de clientes" (CSV/XLSX) com mapeamento, prévia, validação e desfazer. Clientes importados podem entrar já como `ativo` (onboarding marcado como legado) ou `onboarding` — escolha na importação.
8. **Início:** card "Onboardings em andamento" e "Promessas comerciais vencendo" para quem tem permissão.

## Roteiro de teste (obrigatório)
1. Comercial registra o fechamento do cliente "Teste Imobiliária" com Tráfego Meta + Pacote de vídeos (4/mês) + Gerenciamento, anexa um print e promete "primeiro vídeo em 7 dias".
2. Jacque e Luiz recebem notificação/push. O cliente aparece em "Onboarding" com só as abas Visão geral, Ficha, Reuniões e Arquivos.
3. Tentar concluir o onboarding com a ficha incompleta → bloqueado, mostrando o que falta.
4. Preencher ficha e checklist, marcar Luiz (tráfego), Priscila (edição) e Madu (gerenciamento) → concluir.
5. Cliente vira `ativo`; abas de vídeo, gerenciamento e anúncios aparecem; "Demanda do mês" mostra 4 slots de vídeo do mês atual com a Priscila.
6. Entrar como Priscila → vê só "Teste Imobiliária" (e só o resumo operacional da ficha); como Madu → vê o cliente; como um editor não marcado → não vê o cliente (nem por consulta direta).
7. Rodar o job do dia 1º duas vezes para o mês seguinte → 4 slots, sem duplicar.
8. Mudar para 6 vídeos/mês → próximo mês gera 6; mês atual intacto; timeline registra.
9. Importar uma planilha de exemplo com 10 clientes e desfazer.
10. Promessa comercial perto do prazo gera alerta.

Ao terminar, rode `prompts/99-REVISAO-FUNCIONAL.md`.
