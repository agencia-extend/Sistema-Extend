# Prompt 07 — WhatsApp: atendimento (inbox)

**Objetivo:** atender pelo sistema com o número da Extend, transformar conversas em leads e saber de qual anúncio cada conversa veio.

**Leia antes:** `docs/01-requisitos-funcionais.md` seção **WPP**; `docs/04-integracoes.md` (WhatsApp); decisão D4; `briefing/reuniao-2026-11-10/resumo-da-reuniao.md` seção 6 (atendimento e leads). No HubSystem: `src/lib/waha.ts`, `src/lib/whatsapp.ts`, `features/inbox/*` (atenção: `chat-view.tsx` tem 965 linhas — quebre em componentes), webhooks `/api/whatsapp/*`, tabela `ad_referrals`.

**Primeiro me mostre o plano** e espere meu ok. Reaproveite a conexão de número da etapa 06.

## Escopo
1. Webhook assinado por número (WAHA) e, se D4 incluir, Cloud API (verificação + HMAC, modelos aprovados, janela de 24 h).
2. **Inbox (RF-WPP-03):** lista de conversas com não lidas, filtros (minhas, sem responsável, aguardando resposta, grupos, etiquetas), busca; conversa em tempo real (Realtime); enviar texto, imagem, documento e áudio; respostas rápidas; atribuir responsável; etiquetas; encerrar; apagar conversa/grupo; deduplicação de mensagens (`wamid`/`client_ref` únicos).
3. **Importar histórico** ao conectar (RF-WPP-04) com progresso.
4. **Criar lead pela conversa (RF-WPP-05)** — cria o lead do CRM (tabelas da etapa 08: crie aqui o mínimo `leads` se a 08 ainda não existir, e a 08 completa).
5. **Origem do anúncio (RF-WPP-06):** referral de Clique-para-WhatsApp grava campanha/anúncio e cria o lead em "Lead de anúncio".
6. **Radar (RF-WPP-07):** conversas aguardando resposta além do limite → destaque + notificação.
7. Permissões: `inbox.*`; quem não tem não vê nada do WhatsApp (só o envio de relatórios continua funcionando por job).

## Roteiro de teste (obrigatório)
1. Mandar mensagem de um celular para o número → aparece em tempo real; responder pelo sistema → chega no celular.
2. Enviar imagem e áudio nos dois sentidos.
3. Atribuir a conversa a um atendente → ele é notificado; outro atendente filtra "minhas" e não a vê.
4. Criar lead pela conversa → lead com nome/telefone corretos.
5. Clicar num anúncio Clique-para-WhatsApp de teste → conversa chega com a origem e o lead aparece em "Lead de anúncio".
6. Deixar sem resposta além do limite → radar avisa.
7. Usuário sem `inbox.read` não acessa a página nem os dados.

Ao terminar, rode `prompts/99-REVISAO-FUNCIONAL.md`.
