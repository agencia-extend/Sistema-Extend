# Prompt 09 — Propostas comerciais

**Objetivo:** o comercial gera uma proposta com a cara da Extend preenchendo só o que muda (nome, serviços, valor), envia por link/WhatsApp, acompanha se o cliente abriu e o aceite move o negócio para Ganho. Os modelos são editáveis por quem tem permissão. O HubSystem **não** tem este módulo — construa do zero.

**Leia antes:** `docs/01-requisitos-funcionais.md` seção **PRO**; `docs/07-identidade-visual.md`; `briefing/reuniao-2026-11-10/resumo-da-reuniao.md` seção 9.

**Antes do plano, peça o modelo de proposta atual da Extend** (PDF/Canva/Docs) e reproduza a estrutura dele como modelo inicial. Depois mostre o plano e espere meu ok.

## Escopo
1. **Catálogo de serviços com preço (RF-PRO-02)** — reutilize o catálogo da etapa 02 acrescentando descrição comercial e preço padrão (permissão para ver/editar preços).
2. **Editor de modelos (RF-PRO-01):** blocos reordenáveis (capa, sobre, diagnóstico, serviços, investimento, condições, prazos, próximos passos, contato), texto rico com variáveis, imagens, cores da marca; duplicar e versionar modelos.
3. **Gerar proposta (RF-PRO-03):** escolher modelo + negócio/lead (preenche dados), selecionar serviços e ajustar valores/descontos/forma de pagamento/validade, prévia ao vivo idêntica ao PDF, salvar versões.
4. **PDF + link público (RF-PRO-04):** `@react-pdf/renderer`; página `/proposta/[token]` responsiva com botão "Aceitar proposta" (nome + confirmação) e registro de visualizações (data/hora, quantas vezes).
5. **Status e automações (RF-PRO-05):** rascunho, enviada, visualizada, aceita, recusada, expirada (job diário); aceite → negócio em Ganho → fechamento pré-preenchido (etapa 08/02); notificação ao vendedor a cada visualização/aceite.
6. **Enviar pelo WhatsApp (RF-PRO-06)** pelo número da Extend (etapa 06/07), com mensagem modelo.

## Roteiro de teste (obrigatório)
1. Editar o modelo inicial (trocar um texto e reordenar blocos) → nova versão.
2. Gerar proposta para um lead com 2 serviços e desconto → prévia e PDF batem (valores, nome, validade).
3. Enviar pelo WhatsApp → link chega; abrir no celular → status "visualizada" e o vendedor é notificado.
4. Aceitar → negócio vai para Ganho e abre o fechamento pré-preenchido.
5. Proposta vencida → "expirada" e o link mostra que expirou.
6. Usuário sem `proposals.templates.manage` não edita modelos; sem `proposals.read` não vê propostas.

Ao terminar, rode `prompts/99-REVISAO-FUNCIONAL.md`.
