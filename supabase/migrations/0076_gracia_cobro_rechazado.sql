-- #328: gracia después del primer rechazo del cobro de la prueba. El acceso se pausa recién con el SEGUNDO rechazo.
-- _trial_live() (0067) suma un caso: cobro de la prueba o de la beta rechazado una vez (reintento programado, attempts = 1)
-- o con su segundo intento todavía confirmándose, hasta 3 días desde el último intento (por si el cron no corre).
-- Misma regla que inGrace() en src/lib/trial.ts. _has_app_access() y _has_nutrition_access() la respetan sin cambiarlas.
-- El resto de la función queda igual que en 0067.

create or replace function public._trial_live(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user is not null and (
    -- 0043: cuenta nueva desde el lanzamiento, 7 días desde el registro. 0067: solo si se creó antes de la tarjeta obligatoria.
    exists (
      select 1 from public.profiles p
       where p.id = p_user
         and p.created_at >= public._beta_ends_at()
         and p.created_at < public._card_required_from()
         and now() < p.created_at + interval '7 days')
    -- 0045: cuenta de la beta, gratis hasta 7 días después del lanzamiento.
    or exists (
      select 1 from public.profiles p
       where p.id = p_user
         and p.created_at < public._beta_ends_at()
         and now() < public._beta_grace_until())
    -- Regla de 0026 (prueba con tarjeta). 0067: desde la tarjeta obligatoria, con la tarjeta activa.
    or exists (
      select 1
        from public.trial_charges t
        join public.payment_methods m on m.user_id = t.user_id
        join public.profiles p on p.id = t.user_id
       where t.user_id = p_user
         and t.kind = 'prueba'
         and t.status in ('scheduled', 'canceled')
         and p.created_at >= public._beta_ends_at()
         and (p.created_at < public._card_required_from() or t.status = 'canceled' or m.status = 'active')
         and now() < t.trial_ends_at)
    -- 0074 (#328): gracia hasta el segundo intento del primer cobro.
    or exists (
      select 1 from public.trial_charges t
       where t.user_id = p_user
         and t.kind in ('prueba', 'beta')
         and ((t.status = 'retry_scheduled' and t.attempts = 1)
           or (t.status in ('charging', 'pending', 'unknown') and t.attempts = 2 and t.failure_notified_attempt = 1))
         and t.last_attempt_at is not null
         and now() < t.last_attempt_at + interval '3 days'));
$$;
revoke all on function public._trial_live(uuid) from public, anon, authenticated;
