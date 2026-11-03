-- 0065: Testimonios reales (#238). Después del tercer entreno guardado, el resumen pide una opinión (1 a 5 estrellas y
-- un texto opcional de 200 caracteres) con una casilla, sin marcar, para publicarla con el nombre de pila y el país.
-- El admin aprueba en /admin/testimonios cuáles se usan (approved_at). Todavía no se muestran en ninguna parte.
--
-- RLS: cada quien inserta y lee solo la suya (una por cuenta); el admin (is_admin) lee todas y solo él aprueba.
-- La persona solo escribe stars, text y publish_ok: user_id sale de auth.uid() y las fechas las pone la base.
-- Se puede repetir sin daño.

create table if not exists public.testimonials (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  text text check (text is null or char_length(text) between 1 and 200),
  publish_ok boolean not null default false,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  -- Una opinión por cuenta: la tarjeta sale una sola vez.
  constraint testimonials_one_per_user unique (user_id),
  -- Solo se aprueba lo que la persona dejó publicar.
  constraint testimonials_approved_needs_ok check (approved_at is null or publish_ok)
);
create index if not exists testimonials_created on public.testimonials (created_at desc);

alter table public.testimonials enable row level security;
revoke all on public.testimonials from anon, authenticated;
grant select on public.testimonials to authenticated;
grant insert (stars, text, publish_ok) on public.testimonials to authenticated;
grant update (approved_at) on public.testimonials to authenticated;
grant all on public.testimonials to service_role;

drop policy if exists "testimonios: leer la propia o admin" on public.testimonials;
create policy "testimonios: leer la propia o admin" on public.testimonials for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "testimonios: escribir la propia" on public.testimonials;
create policy "testimonios: escribir la propia" on public.testimonials for insert
  with check (user_id = auth.uid() and approved_at is null);
drop policy if exists "testimonios: aprobar admin" on public.testimonials;
create policy "testimonios: aprobar admin" on public.testimonials for update
  using (public.is_admin()) with check (public.is_admin());

comment on table public.testimonials is 'Opiniones después del tercer entreno (#238). publish_ok: permiso para publicar con nombre de pila y país. approved_at: el admin la aprobó para usarla.';

-- Verificación al aplicar: debe salir true.
select count(*) = 3 as testimonios_con_rls from pg_policies where schemaname = 'public' and tablename = 'testimonials';
