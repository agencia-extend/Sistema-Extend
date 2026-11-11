-- Login: o bloqueio temporário conta só tentativas ERRADAS. Antes, logins
-- certos também somavam no limite por IP e a equipe inteira no mesmo Wi-Fi
-- podia ser bloqueada. Agora: consulta (peek) antes; registra (hit) só na falha.
create or replace function public.rate_limit_blocked(p_bucket text, p_max int, p_window_seconds int)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select r.hits >= p_max
    from private.rate_limits r
    where r.bucket = p_bucket and r.window_start >= now() - make_interval(secs => p_window_seconds)
  ), false);
$$;

revoke execute on function public.rate_limit_blocked(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_blocked(text, int, int) to service_role;

-- Limpa contadores de login acumulados pela regra antiga.
delete from private.rate_limits where bucket like 'login%';
