-- Conecta la moderación del admin (reports.status = 'oculto') con la comunidad (posts/comments.hidden)
create or replace function public.sync_report_hidden()
returns trigger language plpgsql security definer set search_path = public as $$
declare hide boolean := new.status = 'oculto';
begin
  if new.target_id !~ '^[0-9]+$' then return new; end if;
  if new.target_type = 'post' then
    update public.posts set hidden = hide or public.is_hidden('post', new.target_id) where id = new.target_id::bigint;
  elsif new.target_type = 'comment' then
    update public.comments set hidden = hide or public.is_hidden('comment', new.target_id) where id = new.target_id::bigint;
  end if;
  return new;
end $$;

drop trigger if exists reports_sync_hidden on public.reports;
create trigger reports_sync_hidden after insert or update of status on public.reports
  for each row execute function public.sync_report_hidden();

-- Evita reportes duplicados del mismo usuario sobre el mismo contenido
create unique index if not exists reports_one_per_reporter on public.reports (reporter, target_type, target_id) where status = 'abierto';
