-- Fotos de progreso (privadas) y medidas
create table if not exists public.progress_photos (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  pose text not null default 'frente' check (pose in ('frente','lado','espalda')),
  path text not null,
  created_at timestamptz not null default now()
);
alter table public.progress_photos enable row level security;
create policy "fotos: propias" on public.progress_photos for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create index if not exists progress_photos_user_day on public.progress_photos (user_id, day desc);

-- Bucket privado: cada usuario solo accede a su carpeta {uid}/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progreso', 'progreso', false, 8388608, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;

create policy "progreso: leer propio" on storage.objects for select using (bucket_id = 'progreso' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "progreso: subir propio" on storage.objects for insert with check (bucket_id = 'progreso' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "progreso: borrar propio" on storage.objects for delete using (bucket_id = 'progreso' and (storage.foldername(name))[1] = auth.uid()::text);
