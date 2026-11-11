# Identidade visual — Agência Extend

Extraída do site atual da agência (`D:\MEU SERVIDOR\AGENCIA EXTEND\css\style.css`) e dos logos em `assets/brand/`. **[CONFIRMAR com a Extend se há manual de marca mais recente.]**

## Logos
- `assets/brand/Logo extend degrade.png` — logo horizontal "ae Agência EXTEND" em degradê azul (fundo claro).
- `assets/brand/logo.png`, `assets/brand/a_extend.png` — variações.
- `assets/brand/favicon.png` / `favicon.ico` — ícone do app (usar também no manifest do PWA, gerando os tamanhos 192/512).

## Cores do site
| Token | Valor | Uso no sistema |
|---|---|---|
| Primária (azul elétrico) | `#1D8AE6` | ações principais, links, foco, seleção |
| Primária hover | `#4FA4F0` | hover/estado ativo |
| Destaque (dourado) | `#FFB800` → `#F7931E` (degradê) | destaques pontuais (metas batidas, vencedor), nunca em texto pequeno |
| Fundo escuro | `#030406` / `#010203` | tema escuro |
| Card escuro | `#0D121E` | superfícies no tema escuro |
| Texto | `#F8FAFC` | texto no escuro |
| Texto secundário | `#94A3B8` | legendas |
| Borda | `rgba(255,255,255,0.08)` | divisórias no escuro |

O sistema deve ter **tema claro e escuro** (padrão: seguir o sistema operacional). Derive a paleta clara a partir do azul primário, com contraste AA.

Cores de status (padronizar em todo o sistema): concluído/aprovado = verde, em andamento = azul primário, em revisão/aguardando = âmbar, atrasado/reprovado = vermelho, pausado/inativo = cinza.

## Tipografia
- Títulos: **Outfit**
- Texto: **Inter**
- Números de métricas: Inter com `font-variant-numeric: tabular-nums`.

## Raios e espaçamento
Raios 8 / 14 / 24 px. Interface de trabalho: densidade média, tabelas legíveis no celular (colunas prioritárias + detalhe ao tocar).
