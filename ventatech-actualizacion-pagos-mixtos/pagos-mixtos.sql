-- ============================================================
-- VentaTech: pagos mixtos y tipo de tarjeta (débito / crédito)
-- OBLIGATORIO: pegar en Supabase > SQL Editor > Run (una sola vez).
-- Se puede volver a ejecutar sin problema.
-- ============================================================

-- 1) Cómo se pagó cada venta: una fila por método.
--    Ej.: venta de RD$ 800 = efectivo 300 + tarjeta débito 500.
create table if not exists public.venta_pagos (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references public.ventas(id) on delete cascade,
  metodo text not null check (metodo in ('efectivo', 'tarjeta', 'transferencia')),
  tipo_tarjeta text check (tipo_tarjeta in ('debito', 'credito')),
  monto numeric(12, 2) not null check (monto > 0),
  created_at timestamptz not null default now(),
  constraint venta_pagos_tipo_solo_tarjeta check (metodo = 'tarjeta' or tipo_tarjeta is null)
);

create index if not exists venta_pagos_venta_id_idx on public.venta_pagos (venta_id);

-- Seguridad: cada usuario ve los pagos de las ventas que ya puede ver
-- (misma empresa). Las escrituras las hace solo el servidor.
alter table public.venta_pagos enable row level security;

drop policy if exists venta_pagos_select on public.venta_pagos;
create policy venta_pagos_select on public.venta_pagos
  for select to authenticated
  using (exists (select 1 from public.ventas v where v.id = venta_pagos.venta_id));

revoke insert, update, delete on public.venta_pagos from anon, authenticated;
grant select on public.venta_pagos to authenticated;
grant all on public.venta_pagos to service_role;

-- 2) Permitir metodo_pago = 'mixto' en ventas.
do $$
declare
  r record;
  tipo text;
  tipo_udt text;
begin
  select data_type, udt_name into tipo, tipo_udt
  from information_schema.columns
  where table_schema = 'public' and table_name = 'ventas' and column_name = 'metodo_pago';

  if tipo = 'USER-DEFINED' then
    -- metodo_pago es un enum: se le agrega el valor.
    execute format('alter type %I add value if not exists %L', tipo_udt, 'mixto');
  else
    -- metodo_pago es texto: se reemplaza el CHECK que limita los valores.
    for r in
      select conname
      from pg_constraint
      where conrelid = 'public.ventas'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%metodo_pago%'
    loop
      execute format('alter table public.ventas drop constraint %I', r.conname);
    end loop;

    alter table public.ventas
      add constraint ventas_metodo_pago_check
      check (metodo_pago in ('efectivo', 'tarjeta', 'transferencia', 'fiado', 'mixto')) not valid;
  end if;
end $$;
