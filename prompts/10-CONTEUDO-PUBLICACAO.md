# Prompt 10 — Conteúdo: cronograma e publicação nas redes

**Objetivo:** o setor de gerenciamento monta o cronograma de cada cliente e publica/agenda no Facebook e Instagram pelo sistema, sem entrar na conta de cada cliente; qualquer pessoa autorizada consegue publicar se a responsável faltar.

**Leia antes:** `docs/01-requisitos-funcionais.md` seção **CON**; `docs/04-integracoes.md` (Meta: permissões de publicação e App Review); `briefing/reuniao-2026-11-10/resumo-da-reuniao.md` seções 3 e 6; no HubSystem: `src/lib/content-publisher.ts` e tabelas `social_accounts`, `content_*`.

**Antes do plano, confirme comigo** se as permissões `pages_manage_posts`, `instagram_basic` e `instagram_content_publish` já foram aprovadas no app da Meta da Extend e verifique a disponibilidade da API de publicação do TikTok (D9). Depois mostre o plano e espere meu ok.

## Escopo
1. **Conectar páginas e contas do Instagram** dos clientes (via BM da Extend) e vincular ao cliente.
2. **Cronograma (RF-CON-01):** calendário mensal por cliente (rascunho, aguardando aprovação, aprovado, agendado, publicado, falhou) e visão do setor de gerenciamento (todos os clientes dela, quais estão com o mês completo × contratado).
3. **Publicar/agendar (RF-CON-03):** post de imagem, carrossel, reels/vídeo e story; legenda, primeiro comentário (se a API permitir), cliente, data/hora; editar ou cancelar agendamento; fila com retry e motivo de falha; mídia vinda do Drive/Storage.
4. **Integração com a produção (RF-CON-04):** card aprovado pelo cliente (etapa 03/04) aparece em "pronto para agendar" com o arquivo e a copy.
5. TikTok só se a API estiver disponível (RF-CON-05); caso contrário, registrar em `docs/06`.

## Roteiro de teste (obrigatório) — com uma página/Instagram de teste da Extend
1. Conectar a página e o Instagram de teste e vincular a um cliente.
2. Agendar um post de imagem para daqui a 10 minutos → publicado no horário; status atualizado.
3. Agendar um reels e cancelar → não publica.
4. Forçar uma falha (mídia inválida) → status "falhou" com motivo e notificação.
5. Card aprovado pelo cliente aparece "pronto para agendar" e, ao publicar, o card do fluxo vai para "Publicado".
6. Usuário sem `content.publish` não vê o botão nem consegue publicar por chamada direta.

Ao terminar, rode `prompts/99-REVISAO-FUNCIONAL.md`.
