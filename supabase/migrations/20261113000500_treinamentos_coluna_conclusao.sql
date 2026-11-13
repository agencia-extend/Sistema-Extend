-- A data de conclusão da atribuição é do sistema (gatilho), não da tela:
-- a revogação por coluna não vale enquanto a tabela inteira tem UPDATE.
revoke update on public.training_assignments from authenticated;
grant update (due_on) on public.training_assignments to authenticated;
