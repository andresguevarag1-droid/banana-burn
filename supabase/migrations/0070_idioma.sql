-- #287 Inglés para Estados Unidos (fase 1): idioma y sistema de unidades de cada cuenta. Idempotente: se puede correr
-- más de una vez.
-- locale: 'es-419' (predeterminado) o 'en-US'. null = todavía no eligió; la app usa la URL (/en) o Accept-Language.
-- units: 'metric' (kg, cm) o 'imperial' (lb, ft/in). null = el del idioma. Los datos siempre se guardan en kg y cm.

alter table public.profiles add column if not exists locale text;
alter table public.profiles add column if not exists units text;

do $$ begin
  alter table public.profiles drop constraint if exists profiles_locale_check;
  alter table public.profiles add constraint profiles_locale_check check (locale is null or locale in ('es-419', 'en-US'));
  alter table public.profiles drop constraint if exists profiles_units_check;
  alter table public.profiles add constraint profiles_units_check check (units is null or units in ('metric', 'imperial'));
end $$;

-- Quien ya terminó la bienvenida antes del inglés queda en español, aunque su teléfono esté en inglés.
update public.profiles set locale = 'es-419' where locale is null and onboarded;

comment on column public.profiles.locale is 'Idioma de la app y de los correos: es-419 (por defecto) o en-US. Se elige en la bienvenida o en Perfil.';
comment on column public.profiles.units is 'Unidades que se muestran: metric (kg, cm) o imperial (lb, ft/in). Los datos se guardan siempre en kg y cm.';
