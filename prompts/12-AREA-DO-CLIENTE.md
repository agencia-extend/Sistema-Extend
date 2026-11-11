# Prompt 12 — Área do cliente

**Objetivo:** o cliente da Extend acessa, por convite, uma área somente leitura com a visão geral do projeto, estratégia, cronograma, materiais, relatórios e aprovações — agrega valor e reduz troca de mensagens. Base para um app nas lojas no futuro.

**Leia antes:** `docs/01-requisitos-funcionais.md` seção **ACL**; `docs/03-permissoes.md` (papel Cliente); `briefing/reuniao-2026-11-10/resumo-da-reuniao.md` seção 10.

**Primeiro me mostre o plano** (o que o cliente vê e o que **nunca** vê: valores internos, comentários internos, outros clientes, dados de outros setores) e espere meu ok.

## Escopo
1. **Convite de usuário do cliente (RF-ACL-01):** pelo ambiente do cliente; papel Cliente; vinculado a um único cliente; RLS dedicada (testes pgTAP específicos).
2. **Portal (RF-ACL-02):** layout próprio e simples (mobile-first) com: visão geral do projeto e progresso do mês, estratégia/planejamento aprovado, cronograma de conteúdo, materiais para baixar (Drive), relatórios (PDFs), aprovações pendentes (mesmo fluxo do link da etapa 04), avaliação de leads (etapa 11).
3. **Notificações (RF-ACL-03):** push (PWA) e/ou mensagem no WhatsApp quando houver conteúdo para aprovar ou relatório novo.
4. **Manual do cliente** (página de ajuda curta) para a implantação de janeiro.

## Roteiro de teste (obrigatório)
1. Convidar o cliente "Teste Imobiliária" → ele entra e vê só os próprios dados.
2. Tentar acessar outro cliente pela URL e por consulta direta → negado.
3. Comentários internos e valores do contrato não aparecem em lugar nenhum.
4. Conteúdo enviado para aprovação → cliente recebe push, aprova pelo portal → o fluxo interno segue.
5. Baixar um material e um relatório.

Ao terminar, rode `prompts/99-REVISAO-FUNCIONAL.md`.
