-- 0046: LinkApp instalada. Recuerda si la persona abrió Banana Burn instalada en la pantalla de inicio (para la métrica
-- de instalación del admin y para no volver a pedirle que la instale). Los avisos activos ya se saben por
-- push_subscriptions. Cada persona solo marca lo suyo (RPC con auth.uid()); la fecha la pone el servidor.
-- Requiere 0031. Idempotente: se puede correr más de una vez.

alter table public.profiles add column if not exists app_installed_at timestamptz;
alter table public.profiles add column if not exists app_last_standalone_at timestamptz;

-- Por la API nadie escribe estas fechas a mano (un update de la persona sobre su perfil las deja como estaban): solo la
-- función de abajo, que corre como dueña (security definer, fuera de is_api_role), y service_role.
create or replace function public._linkapp_dates_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.is_api_role()
     and (new.app_installed_at is distinct from old.app_installed_at or new.app_last_standalone_at is distinct from old.app_last_standalone_at) then
    new.app_installed_at := old.app_installed_at;
    new.app_last_standalone_at := old.app_last_standalone_at;
  end if;
  return new;
end $$;
revoke execute on function public._linkapp_dates_guard() from public, anon, authenticated;
drop trigger if exists profiles_linkapp_guard on public.profiles;
create trigger profiles_linkapp_guard before update of app_installed_at, app_last_standalone_at on public.profiles
  for each row execute function public._linkapp_dates_guard();

/** La app se abrió instalada en un dispositivo de esta persona. La primera fecha queda; la última se actualiza. */
create or replace function public.app_mark_installed()
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  update public.profiles
     set app_installed_at = coalesce(app_installed_at, now()), app_last_standalone_at = now()
   where id = v_uid;
end $$;
revoke execute on function public.app_mark_installed() from public, anon;
grant execute on function public.app_mark_installed() to authenticated;
