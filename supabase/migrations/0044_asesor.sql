-- Banana Burn · 0044 recomendaciones del asesor de Supabase (seguridad y rendimiento), antes del tráfico de anuncios.
-- Idempotente: se puede pegar varias veces en el SQL editor. No abre ningún permiso: solo lo cierra o lo hace más rápido.
--
--   1. search_path fijo en funciones auxiliares que no lo tenían (aviso "Function Search Path Mutable").
--      NO se tocan is_staff(), is_admin(), is_superadmin(), is_content_editor(), is_billing_staff(), is_health_staff(),
--      cr_today() ni _is_today_somewhere(): las usan las políticas y Postgres solo las puede "inlinear" si no llevan SET.
--      Ninguna es security definer (corren con los permisos de quien llama), así que el riesgo de dejarlas así es bajo.
--   2. Funciones de trigger security definer (handle_new_user, sync_report_hidden): nadie las llama por la API.
--      Un trigger no revisa EXECUTE al dispararse, así que quitarlo de anon/authenticated no cambia nada en la app.
--   3. Políticas RLS: auth.uid()/auth.jwt()/auth.role() y los chequeos de rol sin argumentos pasan a (select ...), para
--      que Postgres los evalúe UNA vez por consulta y no por fila (aviso "Auth RLS Initialization Plan"). Mismo
--      resultado, mucho menos trabajo con tablas grandes.
--   4. Índice para cada llave foránea sin índice (aviso "Unindexed foreign keys"): borrados en cascada y joins rápidos.

-- ───────────── 1. search_path ─────────────
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind in ('f', 'p')
      and p.proname in ('touch_updated_at', 'is_api_role', 'guard_profile_privileges', 'sync_challenge_active', '_program_weeks',
                        '_support_context', 'support_number', '_support_staff_can', '_guide_seen_now', '_level_idx', '_power_tier',
                        '_power_points', '_news_seen_now', '_program_days')
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
  loop
    execute format('alter function %s set search_path = public, pg_temp', f);
  end loop;
end $$;

-- ───────────── 2. Triggers security definer: fuera de la API ─────────────
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and p.prorettype = 'trigger'::regtype
      and p.proname in ('handle_new_user', 'sync_report_hidden')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- ───────────── 3. RLS: una evaluación por consulta ─────────────
do $$
declare
  r record;
  q text; c text; nq text; nc text;
  auth_re constant text := '(?<!SELECT )auth\.(uid|jwt|role)\(\)';
  role_re constant text := '(?<![.[:alnum:]_])(?<!SELECT )((public\.)?(is_staff|is_admin|is_superadmin|is_content_editor|is_billing_staff|is_health_staff|is_api_role)\(\))';
begin
  for r in
    select pol.polname, cls.relname, pol.polcmd, pol.polqual, pol.polwithcheck, pol.polrelid
    from pg_policy pol join pg_class cls on cls.oid = pol.polrelid join pg_namespace n on n.oid = cls.relnamespace
    where n.nspname = 'public'
  loop
    q := case when r.polqual is null then null else pg_get_expr(r.polqual, r.polrelid) end;
    c := case when r.polwithcheck is null then null else pg_get_expr(r.polwithcheck, r.polrelid) end;
    nq := regexp_replace(regexp_replace(q, auth_re, '(select auth.\1())', 'g'), role_re, '(select \1)', 'g');
    nc := regexp_replace(regexp_replace(c, auth_re, '(select auth.\1())', 'g'), role_re, '(select \1)', 'g');
    if nq is distinct from q then
      execute format('alter policy %I on public.%I using (%s)', r.polname, r.relname, nq);
    end if;
    if nc is distinct from c then
      execute format('alter policy %I on public.%I with check (%s)', r.polname, r.relname, nc);
    end if;
  end loop;
end $$;

-- ───────────── 4. Índices para llaves foráneas ─────────────
do $$
declare
  r record;
  cols text; idx text;
begin
  for r in
    select c.conrelid, c.conkey, cls.relname
    from pg_constraint c join pg_class cls on cls.oid = c.conrelid
    where c.contype = 'f' and c.connamespace = 'public'::regnamespace
      and not exists (
        select 1 from pg_index i
        where i.indrelid = c.conrelid and (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] = c.conkey
      )
  loop
    select string_agg(quote_ident(a.attname), ', ' order by k.ord), string_agg(a.attname, '_' order by k.ord)
      into cols, idx
    from unnest(r.conkey) with ordinality k(attnum, ord)
    join pg_attribute a on a.attrelid = r.conrelid and a.attnum = k.attnum;
    idx := left(r.relname || '_' || idx || '_fk', 60);
    execute format('create index if not exists %I on public.%I (%s)', idx, r.relname, cols);
  end loop;
end $$;
