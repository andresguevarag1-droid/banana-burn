-- 0072: Correos que rebotaron o marcaron spam. No se les vuelve a escribir (decisión del dueño, 15 nov 2026). Idempotente.
--   Del 2 al 15 nov rebotaron 52 de 768 correos (6.8 %). Gmail y Yahoo castigan la entrega por encima del 4 %.
--   Lo llena el cron de recordatorios (lib/email/suppression.ts), leyendo los envíos recientes de Resend con last_event
--   bounced o complained. sendEmail (lib/email/send.ts) no manda nada a una dirección de aquí.
--   Solo la dirección en minúsculas, el motivo y la fecha. La persona no la lee; solo service_role y el staff.

create table if not exists public.email_suppressions (
  email text primary key check (email = lower(email) and char_length(email) <= 320),
  reason text not null check (reason in ('bounced', 'complained', 'manual')),
  created_at timestamptz not null default now()
);
alter table public.email_suppressions enable row level security;
revoke all on public.email_suppressions from anon, authenticated;
grant select on public.email_suppressions to authenticated;
grant all on public.email_suppressions to service_role;
drop policy if exists "correos suprimidos: staff lee" on public.email_suppressions;
create policy "correos suprimidos: staff lee" on public.email_suppressions for select using (public.is_staff());
