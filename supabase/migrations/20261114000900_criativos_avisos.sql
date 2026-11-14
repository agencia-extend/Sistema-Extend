-- Criativos: avisos nos tipos que já existem (cada pessoa já controla esses tipos nas preferências).
-- Ajuste pedido → "stage_changed"; decisão do cliente → "client_approval".
do $$
declare
  v_src text;
begin
  select pg_get_functiondef('public.review_creative(uuid,text,text)'::regprocedure) into v_src;
  v_src := replace(v_src, $q$'creative', 'Ajustes no criativo: '$q$, $q$'stage_changed', 'Ajustes no criativo: '$q$);
  execute v_src;

  select pg_get_functiondef('public.decide_approval(text,text,text,text,text)'::regprocedure) into v_src;
  v_src := replace(v_src, $q$v_l.created_by], null), 'creative',$q$, $q$v_l.created_by], null), 'client_approval',$q$);
  execute v_src;
end;
$$;
-- A troca de corpo não muda os acessos, mas reforça: a decisão do link é só do servidor.
revoke all on function public.decide_approval(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.decide_approval(text, text, text, text, text) to service_role;
