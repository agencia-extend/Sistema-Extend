# Prompt 11 — Tráfego fase 2: qualidade de leads, metas, reprovações, verba e gestão de campanhas

**Objetivo:** completar o briefing do Luiz com os itens "Importantes, mas podem vir numa 2ª fase".

**Leia antes:** `docs/01-requisitos-funcionais.md` seção **T2**; `briefing/checklist-briefing-trafego.md` (itens da 2ª fase); `docs/04-integracoes.md` (escopo `ads_management` e Conversions API).

**Primeiro me mostre o plano** e espere meu ok.

## Escopo
1. **Qualidade dos leads (RF-T2-01):** cada lead (do WhatsApp/CRM ou de formulário da Meta — Lead Ads via webhook/sincronização) ligado à campanha/anúncio; link público por cliente `/avaliar-leads/[token]` (lista de leads do período com bom/médio/ruim/não atendeu + comentário), também na área do cliente (etapa 12); painel com % qualificados e custo por lead qualificado por campanha/criativo; envio opcional do evento de lead qualificado à Meta pela Conversions API (desligado por padrão, por cliente).
2. **Histórico de reprovações (RF-T2-02):** consolidado por tipo de criativo, formato, ângulo e motivo; aparece no formulário de solicitação (etapa 04) como aviso "o que evitar".
3. **Decisões e aprovações de verba (RF-T2-03):** registro por cliente (valor, período, quem aprovou, data, comprovante); alerta quando o gasto ultrapassar a verba aprovada.
4. **Metas por cliente (RF-T2-04):** CPL, leads, investimento, ROAS por mês; barra de progresso e projeção no painel e nos relatórios (nova variável `{meta_status}`); alerta de ritmo.
5. **Gestão de campanhas (RF-T2-05):** com `ads.manage` — pausar/ativar campanha/conjunto/anúncio, alterar orçamento, duplicar (cópia pausada), Meta e Google; confirmação antes de aplicar; tudo registrado no registro de alterações.

## Roteiro de teste (obrigatório)
1. Gerar o link de avaliação de leads de um cliente imobiliário, avaliar 5 leads como cliente → painel mostra % qualificados e custo por lead qualificado por campanha.
2. Um anúncio reprovado entra no histórico; ao abrir uma nova solicitação para o mesmo cliente, o aviso aparece.
3. Registrar aprovação de verba de R$ X → gasto acima gera alerta.
4. Definir meta de CPL → painel e relatório mostram o status; ritmo ruim gera alerta.
5. Pausar uma campanha pelo sistema → pausada na Meta, registro de alteração criado; gestor sem `ads.manage` não consegue (UI e chamada direta).

Ao terminar, rode `prompts/99-REVISAO-FUNCIONAL.md`.
