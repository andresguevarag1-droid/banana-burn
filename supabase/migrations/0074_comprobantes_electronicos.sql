-- 0074: Comprobante electrónico de Hacienda (Costa Rica) por cada cobro exitoso (#334). Idempotente.
--   Cada cobro verificado (notifyPaid en lib/billing.ts) deja una fila en 'pendiente', una sola vez por cobro (charge_id
--   único: "<procesador>:<referencia>", la misma referencia del recibo). La emisión con Alegra (lib/factura.ts) solo corre
--   con ALEGRA_ENABLED=1; apagada, las filas se quedan en 'pendiente'. Diseño en docs/pagos/factura-electronica.md.
--   La persona lee solo los suyos; solo service_role escribe. user_id queda en null si se borra la cuenta: el comprobante
--   se conserva (el plazo lo confirma el contador).

create table if not exists public.billing_documents (
  id bigint generated always as identity primary key,
  charge_id text not null unique check (char_length(charge_id) between 3 and 200),
  user_id uuid references auth.users(id) on delete set null,
  provider text not null check (provider in ('onvo', 'tilopay')),
  -- tiquete: consumidor final; factura: la persona dio su cédula; exportacion: cliente fuera de Costa Rica.
  kind text not null default 'tiquete' check (kind in ('tiquete', 'factura', 'exportacion')),
  status text not null default 'pendiente' check (status in ('pendiente', 'emitido', 'error')),
  amount_minor bigint check (amount_minor is null or amount_minor >= 0),  -- centavos, IVA incluido
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  number text check (number is null or char_length(number) <= 40),       -- consecutivo de Hacienda (20 dígitos)
  hacienda_key text check (hacienda_key is null or hacienda_key ~ '^[0-9]{50}$'),  -- clave numérica de 50 dígitos
  pdf_url text check (pdf_url is null or pdf_url ~ '^https://'),
  provider_document_id text,                                              -- id de la factura en Alegra
  attempts integer not null default 0,
  last_error text check (last_error is null or char_length(last_error) <= 500),
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'emitido' or (hacienda_key is not null and issued_at is not null))
);
create index if not exists billing_documents_user_idx on public.billing_documents (user_id, created_at desc);
create index if not exists billing_documents_pending_idx on public.billing_documents (created_at) where status <> 'emitido';

alter table public.billing_documents enable row level security;
revoke all on public.billing_documents from anon, authenticated;
grant select on public.billing_documents to authenticated;
grant all on public.billing_documents to service_role;
drop policy if exists "comprobantes: la persona lee los suyos" on public.billing_documents;
create policy "comprobantes: la persona lee los suyos" on public.billing_documents for select to authenticated using (user_id = auth.uid());
