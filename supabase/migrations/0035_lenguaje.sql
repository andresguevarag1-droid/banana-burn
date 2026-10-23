-- 0035: "Cómo te hablo". Cada persona elige cómo le explica Banana Burn el entreno: básico (palabras simples, todo
-- explicado), intermedio (por defecto: términos ligeros explicados una vez) o técnico (RIR, tempo, doble progresión).
-- Solo cambia las palabras: los números del plan son los mismos en los tres.
-- Cada persona edita solo su fila: la política "perfil propio: editar" (0001) ya lo limita y el guardia de rol y plan
-- sigue igual. Idempotente: se puede correr más de una vez.

alter table public.profiles add column if not exists lenguaje text not null default 'intermedio';

do $$ begin
  alter table public.profiles drop constraint if exists profiles_lenguaje_check;
  alter table public.profiles add constraint profiles_lenguaje_check check (lenguaje in ('basico', 'intermedio', 'tecnico'));
end $$;

comment on column public.profiles.lenguaje is 'Registro del lenguaje del entreno: basico, intermedio (por defecto) o tecnico. Solo cambia las explicaciones, nunca los números.';
