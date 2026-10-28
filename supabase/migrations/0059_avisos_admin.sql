-- 0059: Avisos para el superadmin cuando entra alguien o entra dinero.
--
-- Bandeja de salida (admin_events): un disparador en cada tabla donde ya pasa el hecho deja una fila con una clave única
-- (nunca dos avisos del mismo hecho). Los pagos de planes los agrega el servidor (billing.ts, notifyPaid), que es el único
-- lugar que conoce el monto verificado. Un despachador en el servidor (/api/avisos/despachar) arma el texto y manda el
-- push, el aviso dentro de la app y el correo según las preferencias de cada superadmin.
--
-- Nada de esto puede romper un registro ni un cobro: cada disparador atrapa sus propios errores.
-- Si pg_net existe, cada fila nueva despierta al despachador al instante; si no, lo despiertan el servidor y el cron.

create table if not exists public.admin_events (
  id bigint generated always as identity primary key,
  event_key text not null unique check (char_length(event_key) between 3 and 160),
  kind text not null check (kind in ('registro', 'pago', 'tarjeta', 'cobro_fallido', 'cancelacion', 'temporada', 'reto', 'condominio', 'referidor', 'prueba')),
  user_id uuid references auth.users(id) on delete set null,
  amount_minor bigint check (amount_minor is null or amount_minor between 0 and 100000000),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) <= 4000),
  created_at timestamptz not null default now(),
  -- Lo reclama el despachador (una sola vez) y luego anota qué salió.
  claimed_at timestamptz,
  dispatched_at timestamptz,
  push_sent int not null default 0,
  email_sent boolean not null default false,
  error text check (error is null or char_length(error) <= 300)
);
create index if not exists admin_events_pending_idx on public.admin_events (created_at) where dispatched_at is null;
create index if not exists admin_events_created_idx on public.admin_events (created_at desc);

create table if not exists public.admin_notify_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  push boolean not null default true,
  email boolean not null default false,
  -- 'instante': un correo por aviso. 'resumen': solo el resumen diario (cuida el límite de correos del proveedor).
  email_mode text not null default 'resumen' check (email_mode in ('instante', 'resumen')),
  in_app boolean not null default true,
  daily_summary boolean not null default true,
  kinds text[] not null default array['registro','pago','tarjeta','cobro_fallido','cancelacion','temporada','reto','condominio','referidor']::text[]
    check (kinds <@ array['registro','pago','tarjeta','cobro_fallido','cancelacion','temporada','reto','condominio','referidor']::text[]),
  updated_at timestamptz not null default now()
);

alter table public.admin_events enable row level security;
alter table public.admin_notify_prefs enable row level security;
revoke all on public.admin_events from anon, authenticated;
revoke all on public.admin_notify_prefs from anon, authenticated;
grant select on public.admin_events to authenticated;
grant select, insert, update on public.admin_notify_prefs to authenticated;

drop policy if exists admin_events_read on public.admin_events;
create policy admin_events_read on public.admin_events for select to authenticated using (public.is_superadmin());

drop policy if exists admin_notify_prefs_own on public.admin_notify_prefs;
create policy admin_notify_prefs_own on public.admin_notify_prefs for all to authenticated
  using (user_id = auth.uid() and public.is_superadmin())
  with check (user_id = auth.uid() and public.is_superadmin());

-- ───────────── Encolar (solo el servidor y los disparadores) ─────────────
create or replace function public.admin_event_enqueue(p_key text, p_kind text, p_user uuid, p_amount bigint default null, p_currency text default null, p_data jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.admin_events (event_key, kind, user_id, amount_minor, currency, data)
    values (left(p_key, 160), p_kind, p_user, p_amount, upper(nullif(p_currency, '')), coalesce(p_data, '{}'::jsonb))
    on conflict (event_key) do nothing;
exception when others then
  -- Un aviso nunca rompe la operación que lo produjo.
  raise warning 'admin_event_enqueue %: %', p_key, sqlerrm;
end $$;
revoke all on function public.admin_event_enqueue(text, text, uuid, bigint, text, jsonb) from public, anon, authenticated;

-- ───────────── Despertar al despachador (pg_net, si existe) ─────────────
do $$ begin
  create extension if not exists pg_net with schema extensions;
exception when others then
  raise notice 'pg_net no disponible: el despachador lo despiertan el servidor y el cron';
end $$;

create or replace function public.admin_events_kick() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_net') then
    -- Solo despierta al despachador: la ruta no recibe datos, lee la bandeja con service_role.
    execute $q$ select net.http_post(url := 'https://www.bananaburn.app/api/avisos/despachar', body := '{}'::jsonb, headers := '{"Content-Type":"application/json"}'::jsonb, timeout_milliseconds := 5000) $q$;
  end if;
  return null;
exception when others then
  return null;
end $$;
drop trigger if exists admin_events_kick on public.admin_events;
create trigger admin_events_kick after insert on public.admin_events for each statement execute function public.admin_events_kick();

-- ───────────── Disparadores en cada tabla ─────────────

-- Registro: la persona termina la bienvenida (onboarded pasa a true). Una vez por persona.
create or replace function public.admin_ev_profiles() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(old.onboarded, false) = false and new.onboarded = true then
    perform public.admin_event_enqueue('registro:' || new.id, 'registro', new.id, null, null, '{}'::jsonb);
  end if;
  return null;
exception when others then return null;
end $$;
drop trigger if exists admin_ev_profiles on public.profiles;
create trigger admin_ev_profiles after update of onboarded on public.profiles for each row execute function public.admin_ev_profiles();

-- Tarjeta guardada para la prueba (o la beta) y cobros de la prueba rechazados.
create or replace function public.admin_ev_trial() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.admin_event_enqueue('tarjeta:' || new.id, 'tarjeta', new.user_id, new.amount_minor, new.currency,
      jsonb_build_object('plan', new.plan, 'billing', new.billing, 'trial_kind', new.kind, 'charge_at', new.charge_at));
  elsif new.status is distinct from old.status and new.status in ('failed', 'retry_scheduled') then
    perform public.admin_event_enqueue('cobro_fallido:trial:' || new.id || ':' || new.attempts, 'cobro_fallido', new.user_id, new.amount_minor, new.currency,
      jsonb_build_object('plan', new.plan, 'billing', new.billing, 'final', new.status = 'failed', 'attempt', new.attempts, 'origen', 'prueba'));
  end if;
  return null;
exception when others then return null;
end $$;
drop trigger if exists admin_ev_trial on public.trial_charges;
create trigger admin_ev_trial after insert or update of status on public.trial_charges for each row execute function public.admin_ev_trial();

-- Temporadas y retos pagados (y rechazados).
create or replace function public.admin_ev_purchase() returns trigger language plpgsql security definer set search_path = public as $$
declare is_season boolean;
begin
  if new.status is distinct from old.status and new.status in ('pagado', 'fallido') then
    is_season := exists (select 1 from public.seasons s where s.slug = new.challenge_slug);
    if new.status = 'pagado' then
      perform public.admin_event_enqueue((case when is_season then 'temporada:' else 'reto:' end) || new.id, case when is_season then 'temporada' else 'reto' end,
        new.user_id, new.amount_minor, new.currency, jsonb_build_object('slug', new.challenge_slug, 'provider', new.provider));
    else
      perform public.admin_event_enqueue('cobro_fallido:compra:' || new.id, 'cobro_fallido', new.user_id, new.amount_minor, new.currency,
        jsonb_build_object('slug', new.challenge_slug, 'provider', new.provider, 'origen', case when is_season then 'temporada' else 'reto' end));
    end if;
  end if;
  return null;
exception when others then return null;
end $$;
drop trigger if exists admin_ev_purchase on public.challenge_purchases;
create trigger admin_ev_purchase after update of status on public.challenge_purchases for each row execute function public.admin_ev_purchase();

-- Suscripciones: la persona pide cancelar, o una renovación queda pendiente de pago.
create or replace function public.admin_ev_subs() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.cancel_at_period_end = true and coalesce(old.cancel_at_period_end, false) = false then
    perform public.admin_event_enqueue('cancelacion:' || new.id || ':' || coalesce(new.current_period_end::text, ''), 'cancelacion', new.user_id, null, null,
      jsonb_build_object('plan', new.plan, 'billing', new.billing, 'provider', new.provider, 'ends_at', new.current_period_end));
  end if;
  if new.status = 'past_due' and old.status is distinct from 'past_due' then
    perform public.admin_event_enqueue('cobro_fallido:sub:' || new.id || ':' || coalesce(new.current_period_end::text, ''), 'cobro_fallido', new.user_id, null, null,
      jsonb_build_object('plan', new.plan, 'billing', new.billing, 'provider', new.provider, 'origen', 'renovacion'));
  end if;
  return null;
exception when others then return null;
end $$;
drop trigger if exists admin_ev_subs on public.subscriptions;
create trigger admin_ev_subs after update of cancel_at_period_end, status on public.subscriptions for each row execute function public.admin_ev_subs();

-- Prospectos: condominios que piden la reunión y personas nuevas que llegan con el enlace de un referidor.
create or replace function public.admin_ev_lead() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'b2b_leads' then
    perform public.admin_event_enqueue('condominio:' || new.id, 'condominio', null, null, null,
      jsonb_build_object('org', left(new.org_name, 100), 'units', new.units, 'location', left(coalesce(new.location, ''), 100)));
  elsif tg_table_name = 'affiliate_referrals' then
    perform public.admin_event_enqueue('referidor:' || new.user_id, 'referidor', new.user_id, null, null,
      jsonb_build_object('affiliate', new.affiliate_id));
  end if;
  return null;
exception when others then return null;
end $$;
drop trigger if exists admin_ev_lead on public.b2b_leads;
create trigger admin_ev_lead after insert on public.b2b_leads for each row execute function public.admin_ev_lead();
drop trigger if exists admin_ev_lead on public.affiliate_referrals;
create trigger admin_ev_lead after insert on public.affiliate_referrals for each row execute function public.admin_ev_lead();

-- Verificación al aplicar: deben salir 6 disparadores.
select count(*) as disparadores_de_avisos from pg_trigger where tgname ~ '^admin_ev_(profiles|trial|purchase|subs|lead)$' and not tgisinternal;
