-- 0060: Enlaces de un toque en los correos de recordatorio.
-- Quien se registra desde el navegador de Instagram o Facebook abre el correo en otro navegador, sin sesión, y chocaba con
-- la pantalla de entrar. El correo lleva un enlace firmado (72 h) que inicia sesión una sola vez: aquí se anota cada uso.
-- Solo el servidor (service_role) lee y escribe: sin políticas para anon ni authenticated.

create table if not exists public.email_login_uses (
  nonce text primary key check (char_length(nonce) between 16 and 64),
  user_id uuid not null references auth.users(id) on delete cascade,
  used_at timestamptz not null default now()
);
create index if not exists email_login_uses_used_at on public.email_login_uses (used_at);
alter table public.email_login_uses enable row level security;
revoke all on public.email_login_uses from anon, authenticated;
grant select, insert, delete on public.email_login_uses to service_role;

comment on table public.email_login_uses is 'Enlaces de un toque de los correos ya usados (un enlace sirve una vez). Solo service_role.';
