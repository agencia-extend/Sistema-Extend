# Prompt 99 — Revisão funcional (cole ao fim de CADA etapa)

A etapa atual está terminada do seu ponto de vista. Agora prove que **tudo funciona** antes de seguirmos. Siga em ordem e não pule nada:

1. **Requisitos:** liste cada requisito (`RF-...`) da etapa (veja o prompt da etapa e `docs/01-requisitos-funcionais.md`) com o status: ✅ feito e testado / ⚠️ parcial (o que falta) / ❌ não feito (por quê).
2. **Varredura de "não funcional":** procure no código por `TODO`, `FIXME`, `mock`, `fake`, `placeholder`, `lorem`, `em breve`, `coming soon`, `console.log`, `as unknown as`, `any`, botões sem `onClick`/`action`, links para `#`, rotas 404 no menu. Corrija ou justifique cada ocorrência.
3. **Banco:** rode `supabase db lint`, os testes pgTAP (`supabase test db`) e gere os tipos de novo. Toda tabela nova tem RLS e teste por papel?
4. **Testes:** rode `npm run typecheck`, `npm run lint`, `npm run test` (Vitest) e os testes Playwright da etapa (`e2e/`). Mostre o resultado resumido. Falhou → corrija e rode de novo.
5. **Roteiro manual de ponta a ponta:** execute o "Roteiro de teste" do prompt da etapa no navegador (Playwright ou o navegador do app), com usuários de **papéis diferentes** (pelo menos admin + um papel restrito), e confirme que o papel restrito **não vê** o que não deve (inclusive chamando a API/consulta direto).
6. **Celular:** teste as telas da etapa em 375 px de largura. Nada cortado, nada com rolagem horizontal, alvos de toque ≥ 44 px.
7. **Interface:** rode a skill `web-design-guidelines` nas telas da etapa e corrija o que ela apontar (acessibilidade, foco, contraste, estados vazio/carregando/erro).
8. **Erros e integrações:** simule falha de rede/API externa (token inválido, timeout) e confirme mensagem clara e que a tela não quebra.
9. **Documentação:** atualize `docs/` se alguma decisão mudou e registre em `docs/06-decisoes-e-pendencias.md` o que ficou pendente.
10. **Relato final** para mim, curto: o que foi entregue, como foi testado, o que ficou pendente e por quê, e o que eu preciso fazer/decidir antes da próxima etapa. Faça um commit com a mensagem `etapa NN concluída: <resumo>`.
