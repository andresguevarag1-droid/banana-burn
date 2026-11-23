-- 0074 (#329): consentimiento del cobro recurrente. Idempotente. Correr antes del domingo 22 de noviembre de 2026.
--   Desde el 23 nov la tarjeta es obligatoria. Cada cuenta ve, justo arriba del botón que guarda la tarjeta, cuándo y cuánto se
--   cobra y cada cuánto se repite, y acepta al tocarlo. Aquí queda la prueba (Ley 7472 y contracargos): una fila por
--   aceptación, con la versión del texto, el plan, los montos y la fecha del primer cobro que calculó el servidor.
--   La escribe solo el servidor (service_role, trial-billing.ts) justo antes de programar el cobro: sin fila no hay cobro.
--   Nunca la IP completa: solo el país de la conexión (ip_country), si lo tenemos.
--   La persona lee las suyas; el staff las ve en /admin/usuarios/[id].
--   Si no se corre: guardar una tarjeta que programa un cobro falla con "No pudimos guardar tu autorización" (no se cobra nada).

create table if not exists public.billing_consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  accepted_at timestamptz not null default now(),
  text_version text not null check (char_length(text_version) between 1 and 40),
  plan text not null check (plan in ('entreno', 'completo')),
  billing text not null check (billing in ('mes', 'anual')),
  first_amount_minor integer not null check (first_amount_minor > 0),
  full_amount_minor integer not null check (full_amount_minor > 0),
  first_charge_at timestamptz not null,
  processor text not null check (processor in ('onvo', 'tilopay')),
  ip_country text check (ip_country ~ '^[A-Z]{2}$')
);
create index if not exists billing_consents_user_idx on public.billing_consents (user_id, accepted_at desc);

alter table public.billing_consents enable row level security;
revoke all on public.billing_consents from public, anon, authenticated;
grant select on public.billing_consents to authenticated;
grant all on public.billing_consents to service_role;
drop policy if exists "consentimiento: leer el propio" on public.billing_consents;
create policy "consentimiento: leer el propio" on public.billing_consents for select to authenticated using (user_id = auth.uid() or public.is_staff());
