# Prompt 04 — Criativos: solicitação tráfego → mídias, aprovação e biblioteca

**Objetivo:** o **módulo mais importante** para a Extend. Acabar com criativo pedido por WhatsApp/áudio: o gestor pede por um formulário completo, a mídia produz no fluxo, as versões e aprovações ficam registradas (interna e do cliente por link), e todo criativo aprovado entra na biblioteca.

**Leia antes:** `docs/01-requisitos-funcionais.md` seções **CRI e BIB**; `briefing/checklist-briefing-trafego.md` itens 3 e 4; `briefing/reuniao-2026-11-10/resumo-da-reuniao.md` seções 6 (aprovação) e 8; no HubSystem: `task_deliveries*`, `src/app/aprovar/[token]`, `src/app/aprovar/entrega/[token]`.

**Primeiro me mostre o plano** e espere meu ok.

## Escopo
1. **Formulário de solicitação (RF-CRI-01, 02):** campos obrigatórios bloqueando o envio; painel lateral com o resumo do onboarding do cliente (tom de voz, restrições da Meta, identidade, materiais autorizados) e os últimos criativos vencedores/reprovados; anexar referências. Ao enviar: cria a solicitação + card no fluxo de criativos (usa os fluxos da etapa 03) atribuído à mídia do cliente.
2. **Quadro de criativos (RF-CRI-03):** status `solicitado → em produção → em revisão → aprovado → entregue → no ar` (+ ajustes solicitados, cancelado), Kanban e lista, filtros por cliente, gestor, mídia, formato, prazo, prioridade. Visão "meus pedidos" para o gestor.
3. **Versões (RF-CRI-04):** cada entrega gera v1, v2…; arquivos (Drive/Storage) com preview de imagem e player de vídeo; comentários por versão.
4. **Aprovação interna (RF-CRI-05):** gestor aprova ou pede ajuste com comentário.
5. **Aprovação do cliente por link (RF-CRI-06):** página pública `/aprovar/[token]` responsiva, com a marca da Extend, mostrando a(s) peça(s) e a copy; 👍 aprovar / 👎 pedir alteração (texto obrigatório); token com hash e validade; registro de data/hora/IP; botão no sistema "copiar link" e "enviar no WhatsApp" (abre `wa.me` com a mensagem pronta; o envio pelo número da Extend vem na etapa 06/07). O mesmo mecanismo serve para **qualquer entrega da etapa 03** (vídeos e artes de conteúdo) — implemente de forma genérica.
6. **Notificações (RF-CRI-07):** cada mudança notifica quem pediu e quem produz; "criativo pronto" e "cliente aprovou/pediu alteração" com push.
7. **Biblioteca (RF-BIB-01, 02, 04):** criativo aprovado entra com cliente, campanha (texto livre ou plano da etapa 05), formato, ângulo, copy (texto principal, título, descrição), arquivo e status (em teste, vencedor, fadigado, reprovado pela Meta, arquivado). Busca e filtros. A performance (RF-BIB-03) e o botão "pedir novo criativo" a partir do anúncio (RF-CRI-08) entram na etapa 05 — deixe o modelo de dados pronto para isso, sem mostrar nada falso na tela.
8. **Exportar (RF-BIB-05)** lista de criativos do período (PDF/CSV + links/zip dos arquivos).

## Roteiro de teste (obrigatório)
1. Luiz tenta enviar uma solicitação sem ângulo e sem prazo → bloqueado com mensagens claras.
2. Envia completa para "Teste Imobiliária" (vídeo, ângulo "dor do aluguel", CTA WhatsApp) → a mídia recebe push; o card aparece em "solicitado".
3. Mídia move para "em produção", sobe a v1 e move para "em revisão" → Luiz recebe "criativo pronto".
4. Luiz pede ajuste → status "ajustes solicitados", mídia notificada; mídia sobe v2.
5. Luiz aprova internamente e gera o link do cliente → abrir o link numa janela anônima no celular → 👎 com comentário → volta para a mídia com o comentário; v3 → novo link → 👍.
6. Criativo vai para "aprovado", entra na biblioteca com a copy; Luiz marca "entregue" e depois "no ar".
7. Link expirado ou reutilizado após decisão → mensagem adequada, sem permitir nova decisão.
8. Um editor de outro cliente não vê a solicitação (UI e consulta direta).
9. Exportar a biblioteca do mês em PDF e CSV.

Ao terminar, rode `prompts/99-REVISAO-FUNCIONAL.md`.
