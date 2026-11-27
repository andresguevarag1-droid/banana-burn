-- #332: campaña "primer mes al 50 %" para las cuentas creadas antes de la tarjeta obligatoria (23 nov 2026).
-- Una fila por cuenta a la que se le envió el correo: desde ese momento y hasta expires_at, su primer cobro mensual va al
-- 50 % (promoFor con offer). Solo la escribe el servidor (service_role) al enviar; nadie la lee desde el navegador.
create table if not exists public.promo_offers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  campaign text not null check (campaign in ('campana_50_actuales')),
  segment text not null check (segment in ('entrenaron', 'sin_entreno')),
  sent_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.promo_offers enable row level security;
-- Sin políticas para anon ni authenticated: solo service_role (que salta RLS) la lee y la escribe.
revoke all on table public.promo_offers from anon, authenticated;
grant all on table public.promo_offers to service_role;
