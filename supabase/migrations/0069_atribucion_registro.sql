-- 0069: De qué anuncio viene cada registro (#283). Idempotente.
--   La primera visita con utm_* o fbclid deja una cookie de primer contacto (components/ref-capture.tsx, 30 días, no se pisa).
--   Al crear la cuenta, el servidor la guarda aquí una sola vez (lib/attribution-server.ts). Solo los parámetros de la URL,
--   el path de llegada y la fecha: sin IP ni user agent. La persona no la lee; solo service_role y el staff (embudo del admin).

create table if not exists public.signup_attribution (
  user_id uuid primary key references auth.users(id) on delete cascade,
  utm_source text check (char_length(utm_source) <= 200),
  utm_medium text check (char_length(utm_medium) <= 200),
  utm_campaign text check (char_length(utm_campaign) <= 200),
  utm_content text check (char_length(utm_content) <= 200),
  utm_term text check (char_length(utm_term) <= 200),
  fbclid text check (char_length(fbclid) <= 200),
  landing text check (char_length(landing) <= 200),
  first_seen_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.signup_attribution enable row level security;
revoke all on public.signup_attribution from anon, authenticated;
grant select on public.signup_attribution to authenticated;
grant all on public.signup_attribution to service_role;
drop policy if exists "atribución del registro: staff lee" on public.signup_attribution;
create policy "atribución del registro: staff lee" on public.signup_attribution for select using (public.is_staff());

-- Escribe la atribución una sola vez y solo para cuentas de menos de 72 h (Google también pasa por aquí al volver a entrar).
create or replace function public.signup_attribution_save(
  p_user uuid, p_source text, p_medium text, p_campaign text, p_content text, p_term text, p_fbclid text, p_landing text, p_first_seen timestamptz
) returns text language plpgsql security definer set search_path = public as $$
declare created timestamptz;
begin
  if p_user is null then return 'sin_datos'; end if;
  select u.created_at into created from auth.users u where u.id = p_user;
  if created is null or created < now() - interval '72 hours' then return 'cuenta_existente'; end if;
  insert into public.signup_attribution (user_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, landing, first_seen_at)
    values (p_user, left(p_source, 200), left(p_medium, 200), left(p_campaign, 200), left(p_content, 200), left(p_term, 200), left(p_fbclid, 200), left(p_landing, 200),
      case when p_first_seen > now() then null else p_first_seen end)
    on conflict (user_id) do nothing;
  if not found then return 'ya_guardada'; end if;
  return 'guardada';
end $$;
revoke all on function public.signup_attribution_save(uuid, text, text, text, text, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.signup_attribution_save(uuid, text, text, text, text, text, text, text, timestamptz) to service_role;

comment on table public.signup_attribution is 'Parámetros de la URL (utm_*, fbclid), path y fecha de la primera visita de cada cuenta. Se escribe una vez al registrarse (#283).';

-- Verificación al aplicar: debe salir true.
select count(*) = 1 as atribucion_con_rls from pg_policies where schemaname = 'public' and tablename = 'signup_attribution';
