-- Comunidad "La tropa": tipos de publicación, ranking por alcance, Descubrir con filtros, niveles y estadísticas de perfil.
-- Idempotente (create or replace / drop if exists). No cambia ninguna política RLS existente.
--   1. guard_post_write: las publicaciones de texto pueden llevar SOLO data = {"tag": <tipo permitido>}. Todo lo demás se descarta.
--   2. community_board(alcance): ranking semanal 'siguiendo' | 'pais' | 'global' con tu posición aunque no estés en el top.
--   3. community_people(filtro): personas con perfil público para Descubrir ('todos' | 'cerca' | 'objetivo' | 'activos').
--      Nunca expone país, objetivo ni datos de salud: solo si coinciden contigo (booleanos).
--   4. community_levels(ids): XP total (para el nivel) de quien comparte sus entrenos y es visible.
--   5. community_profile_stats(usuario): entrenos, récords y XP de un perfil que puedes ver.

-- ───────────── 1. Publicaciones: etiqueta de tipo en las de texto ─────────────
create or replace function public.guard_post_write()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.is_api_role() then return new; end if;
  if tg_op = 'INSERT' then
    new.hidden := false;
    new.created_at := now();
    if new.kind = 'text' then
      new.workout_id := null;
      -- Solo la etiqueta de tipo (logro, pregunta…); cualquier otro dato que mande el cliente se descarta.
      new.data := case
        when jsonb_typeof(new.data) = 'object' and (new.data ->> 'tag') in ('entreno', 'logro', 'pregunta', 'comida', 'progreso')
          then jsonb_build_object('tag', new.data ->> 'tag')
        else '{}'::jsonb end;
    elsif new.kind = 'workout' then
      if new.workout_id is null or not exists (select 1 from public.workouts w where w.id = new.workout_id and w.user_id = auth.uid()) then
        raise exception 'Entreno inválido' using errcode = '42501';
      end if;
      if exists (select 1 from public.posts p where p.workout_id = new.workout_id) then
        raise exception 'Este entreno ya está publicado' using errcode = '23505';
      end if;
    else
      raise exception 'Tipo de publicación no permitido' using errcode = '42501';
    end if;
    return new;
  end if;
  -- UPDATE (igual que 0014)
  if old.user_id = auth.uid() and not public.is_staff() then
    if new.hidden is distinct from old.hidden or new.user_id is distinct from old.user_id or new.kind is distinct from old.kind
       or new.workout_id is distinct from old.workout_id or new.data is distinct from old.data or new.created_at is distinct from old.created_at then
      raise exception 'Solo puedes editar el texto y la visibilidad' using errcode = '42501';
    end if;
  elsif public.is_staff() then
    if new.user_id is distinct from old.user_id or new.kind is distinct from old.kind or new.workout_id is distinct from old.workout_id
       or new.data is distinct from old.data or new.created_at is distinct from old.created_at
       or (old.user_id <> auth.uid() and (new.body is distinct from old.body or new.visibility is distinct from old.visibility)) then
      raise exception 'El staff solo puede ocultar o mostrar contenido ajeno' using errcode = '42501';
    end if;
    if old.user_id = auth.uid() and new.hidden is distinct from old.hidden and not public.is_admin() then
      raise exception 'No puedes moderar tu propio contenido' using errcode = '42501';
    end if;
  else
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists posts_guard on public.posts;
create trigger posts_guard before insert or update on public.posts for each row execute function public.guard_post_write();

-- ───────────── Ayudas internas ─────────────
/** Lunes 00:00 de la semana local de quien mira (fecha e instante), igual que weekly_leaderboard (0013). */
create or replace function public._community_week()
returns table (d date, ts timestamptz)
language sql stable security definer set search_path = public as $$
  with me as (
    select coalesce((select np.timezone from notification_prefs np where np.user_id = auth.uid() and np.timezone is not null
                       and exists (select 1 from pg_timezone_names z where z.name = np.timezone)), 'America/Costa_Rica') as tz
  )
  select date_trunc('week', now() at time zone me.tz)::date, (date_trunc('week', now() at time zone me.tz) at time zone me.tz) from me;
$$;
revoke execute on function public._community_week() from public, anon, authenticated;

-- ───────────── 2. Ranking semanal por alcance ─────────────
drop function if exists public.community_board(text);
create function public.community_board(p_scope text default 'siguiendo')
returns table (user_id uuid, username text, full_name text, workouts bigint, xp bigint, total_xp bigint, pos bigint)
language sql stable security definer set search_path = public as $$
  with wk as (select * from public._community_week()),
  mine as (select country from profiles where id = auth.uid()),
  pool as (
    select p.id, p.username, p.full_name from profiles p
    where auth.uid() is not null and (
      p.id = auth.uid()
      or (coalesce(p_scope, 'siguiendo') = 'siguiendo'
          and p.visibility <> 'privado' and p.share_workouts
          and exists (select 1 from follows f where f.follower = auth.uid() and f.followee = p.id))
      or (p_scope in ('global', 'pais')
          and p.visibility = 'publico' and p.share_workouts and p.username is not null and p.suspended_at is null
          and (p_scope = 'global' or p.country is not distinct from (select country from mine)))
    )
  ),
  scored as (
    select pool.id, pool.username, pool.full_name,
      (select count(distinct w.day) from workouts w, wk where w.user_id = pool.id and w.day >= wk.d) as workouts,
      (select coalesce(sum(x.xp), 0) from xp_events x, wk where x.user_id = pool.id and x.created_at >= wk.ts)::bigint as xp
    from pool
  ),
  ranked as (
    select s.*, rank() over (order by s.xp desc) as pos from scored s where s.xp > 0 or s.id = auth.uid()
  )
  select r.id, r.username, r.full_name, r.workouts, r.xp,
    (select coalesce(sum(x.xp), 0) from xp_events x where x.user_id = r.id)::bigint,
    r.pos
  from ranked r
  where r.pos <= 50 or r.id = auth.uid()
  order by r.pos, r.username
  limit 51;
$$;
revoke execute on function public.community_board(text) from public, anon;
grant execute on function public.community_board(text) to authenticated;

-- ───────────── 3. Descubrir: personas con perfil público ─────────────
drop function if exists public.community_people(text);
create function public.community_people(p_filter text default 'todos')
returns table (id uuid, username text, full_name text, bio text, same_country boolean, same_goal boolean, active_days bigint, total_xp bigint, followers bigint)
language sql stable security definer set search_path = public as $$
  with mine as (select country, goal_type from profiles where id = auth.uid()),
  people as (
    select p.id, p.username, p.full_name, p.bio, p.share_workouts,
      (p.country is not null and p.country = (select country from mine)) as same_country,
      (p.goal_type = (select goal_type from mine)) as same_goal
    from profiles p
    where auth.uid() is not null and p.id <> auth.uid() and p.username is not null
      and p.visibility = 'publico' and p.suspended_at is null
      and not exists (select 1 from follows f where f.follower = auth.uid() and f.followee = p.id)
  ),
  scored as (
    select pe.id, pe.username, pe.full_name, pe.bio, pe.same_country, pe.same_goal,
      case when pe.share_workouts then (select count(distinct w.day) from workouts w where w.user_id = pe.id and w.day >= current_date - 14) else 0 end as active_days,
      case when pe.share_workouts then (select coalesce(sum(x.xp), 0) from xp_events x where x.user_id = pe.id)::bigint end as total_xp,
      (select count(*) from follows f where f.followee = pe.id) as followers
    from people pe
  )
  select s.id, s.username, s.full_name, s.bio, s.same_country, s.same_goal, s.active_days, s.total_xp, s.followers
  from scored s
  where case coalesce(p_filter, 'todos')
    when 'cerca' then s.same_country
    when 'objetivo' then s.same_goal
    when 'activos' then s.active_days > 0
    else true end
  order by s.active_days desc, s.followers desc, s.username
  limit 24;
$$;
revoke execute on function public.community_people(text) from public, anon;
grant execute on function public.community_people(text) to authenticated;

-- ───────────── 4. Niveles (XP total) para las insignias junto al nombre ─────────────
drop function if exists public.community_levels(uuid[]);
create function public.community_levels(p_ids uuid[])
returns table (user_id uuid, total_xp bigint)
language sql stable security definer set search_path = public as $$
  select p.id, (select coalesce(sum(x.xp), 0) from xp_events x where x.user_id = p.id)::bigint
  from profiles p
  where auth.uid() is not null and p.id = any (p_ids[1:100])
    and (p.id = auth.uid() or (p.visibility <> 'privado' and p.share_workouts));
$$;
revoke execute on function public.community_levels(uuid[]) from public, anon;
grant execute on function public.community_levels(uuid[]) to authenticated;

-- ───────────── 5. Estadísticas de un perfil ─────────────
/** Solo si puedes ver sus entrenos: es tu perfil, o comparte entrenos y es público (o lo sigues y es para seguidores). */
drop function if exists public.community_profile_stats(uuid);
create function public.community_profile_stats(p_user uuid)
returns table (workouts_total bigint, workouts_week bigint, prs_total bigint, total_xp bigint, last_days date[])
language sql stable security definer set search_path = public as $$
  with wk as (select * from public._community_week())
  select
    (select count(*) from workouts w where w.user_id = p.id),
    (select count(distinct w.day) from workouts w, wk where w.user_id = p.id and w.day >= wk.d),
    (select count(*) from xp_events x where x.user_id = p.id and x.kind = 'pr'),
    (select coalesce(sum(x.xp), 0) from xp_events x where x.user_id = p.id)::bigint,
    (select coalesce(array_agg(distinct w.day order by w.day desc), '{}') from workouts w where w.user_id = p.id and w.day >= current_date - 60)
  from profiles p
  where auth.uid() is not null and p.id = p_user
    and (p.id = auth.uid() or (p.share_workouts and (
      p.visibility = 'publico'
      or (p.visibility = 'seguidores' and exists (select 1 from follows f where f.follower = auth.uid() and f.followee = p.id)))));
$$;
revoke execute on function public.community_profile_stats(uuid) from public, anon;
grant execute on function public.community_profile_stats(uuid) to authenticated;
