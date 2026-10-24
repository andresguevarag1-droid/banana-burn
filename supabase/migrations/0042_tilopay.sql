-- Banana Burn · 0042 Tilopay (tarjetas de fuera de Costa Rica)
-- Idempotente: se puede pegar varias veces en el SQL editor sobre una BD con 0001-0041.
-- Qué hace (decisión del dueño, octubre de 2026):
--   1. payment_methods acepta provider 'onvo' o 'tilopay' (antes solo 'onvo'); trial_charges no tiene proveedor (usa la
--      tarjeta guardada). El token de tarjeta de
--      Tilopay puede ser más largo que un ID de ONVO: hasta 400 caracteres.
--   2. subscriptions: columnas para las renovaciones que cobramos nosotros con Tilopay (Tilopay no lleva la suscripción):
--        renewal_attempts         intentos del periodo que vence (0 = al día)
--        next_renewal_attempt_at  cuándo toca el próximo intento (también sirve de reclamo: un solo proceso cobra)
--        last_renewal_error       último motivo, o "por confirmar:<orden>" si la respuesta se perdió
--      y provider solo 'onvo' o 'tilopay'.
--   3. Nada cambia para quien paga con ONVO. El acceso pagado lo sigue dando solo el servidor con un resultado verificado.
--      Las columnas nuevas no se exponen a la persona (las escribe solo service_role, como el resto de subscriptions).

-- ───────────── 1. Tarjeta guardada y cobro programado ─────────────
do $$
declare c record;
begin
  -- Quita los checks viejos de provider y del largo del ID de la tarjeta (nombres automáticos de 0026).
  for c in
    select con.conname, rel.relname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public' and con.contype = 'c'
      and ((rel.relname = 'payment_methods' and pg_get_constraintdef(con.oid) ~ 'provider = ''onvo''')
        or (rel.relname = 'payment_methods' and pg_get_constraintdef(con.oid) ~ 'char_length\(provider_payment_method_id\)'))
  loop
    execute format('alter table public.%I drop constraint %I', c.relname, c.conname);
  end loop;
end $$;

alter table public.payment_methods drop constraint if exists payment_methods_provider_ok;
alter table public.payment_methods add constraint payment_methods_provider_ok check (provider in ('onvo', 'tilopay'));
alter table public.payment_methods drop constraint if exists payment_methods_pm_len;
alter table public.payment_methods add constraint payment_methods_pm_len check (char_length(provider_payment_method_id) between 1 and 400);

-- ───────────── 2. Renovaciones con Tilopay ─────────────
alter table public.subscriptions
  add column if not exists renewal_attempts smallint not null default 0,
  add column if not exists next_renewal_attempt_at timestamptz,
  add column if not exists last_renewal_error text;

alter table public.subscriptions drop constraint if exists subscriptions_renewal_attempts_ok;
alter table public.subscriptions add constraint subscriptions_renewal_attempts_ok check (renewal_attempts between 0 and 10);
alter table public.subscriptions drop constraint if exists subscriptions_renewal_error_len;
alter table public.subscriptions add constraint subscriptions_renewal_error_len check (last_renewal_error is null or char_length(last_renewal_error) <= 300);
alter table public.subscriptions drop constraint if exists subscriptions_provider_ok;
-- not valid: no revisa filas viejas (por si alguna tiene otro valor histórico); sí aplica a toda fila nueva o editada.
alter table public.subscriptions add constraint subscriptions_provider_ok check (provider in ('onvo', 'tilopay')) not valid;

-- El barrido diario busca solo las de Tilopay que vencen (pocas filas).
create index if not exists subscriptions_tilopay_due_idx on public.subscriptions (current_period_end)
  where provider = 'tilopay' and status in ('active', 'past_due');

-- Mínimo privilegio: la persona nunca escribe en subscriptions (ya era así); se repite por si acaso.
revoke insert, update, delete on public.subscriptions from anon, authenticated;
