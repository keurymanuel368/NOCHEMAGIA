-- ============================================================
-- VentaTech: anular facturas (con registro de quién, cuándo y por qué)
-- Pegar en Supabase > SQL Editor > Run (una sola vez; se puede repetir).
-- ============================================================

-- 1) Registro de anulaciones. La factura NO se borra: queda "anulada" y aquí
--    se guarda quién la anuló, cuándo, por qué y si fue desde modo soporte.
create table if not exists public.ventas_anuladas (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null unique references public.ventas(id) on delete cascade,
  numero_factura text,
  total numeric(12, 2),
  motivo text not null,
  anulada_por uuid,
  anulada_por_nombre text,
  en_modo_soporte boolean not null default false,
  anulada_at timestamptz not null default now()
);

alter table public.ventas_anuladas enable row level security;
drop policy if exists ventas_anuladas_select on public.ventas_anuladas;
create policy ventas_anuladas_select on public.ventas_anuladas
  for select to authenticated
  using (exists (select 1 from public.ventas v where v.id = ventas_anuladas.venta_id));
revoke insert, update, delete on public.ventas_anuladas from anon, authenticated;
grant select on public.ventas_anuladas to authenticated;
grant all on public.ventas_anuladas to service_role;

-- 2) Permitir el estado 'anulada' en ventas (si hay una regla CHECK que lo impida).
do $$
declare
  r record;
  valores text;
begin
  for r in
    select conname, pg_get_constraintdef(oid) as def
    from pg_constraint
    where conrelid = 'public.ventas'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%estado%'
      and pg_get_constraintdef(oid) not ilike '%anulada%'
  loop
    execute format('alter table public.ventas drop constraint %I', r.conname);
    select string_agg(quote_literal(e), ', ') into valores from (
      select distinct estado as e from public.ventas where estado is not null
      union select unnest(array['completada', 'anulada', 'devuelta'])) x;
    execute format('alter table public.ventas add constraint ventas_estado_check check (estado in (%s)) not valid', valores);
  end loop;
end $$;

-- 3) Anular una factura, todo o nada:
--    - devuelve los productos al inventario,
--    - quita la deuda si fue a fiado y recalcula el saldo del cliente,
--    - marca la venta como 'anulada' (sale de caja, dashboard y reportes),
--    - deja el registro en ventas_anuladas.
--    Solo la puede llamar el servidor (que ya comprobó los permisos).
create or replace function public.anular_venta(
  p_venta_id uuid,
  p_motivo text,
  p_usuario_id uuid,
  p_usuario_nombre text,
  p_modo_soporte boolean
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
begin
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Escribe el motivo de la anulación';
  end if;

  select id, numero_factura, total, estado, cliente_id into v
  from ventas where id = p_venta_id for update;
  if not found then
    raise exception 'La factura no existe';
  end if;
  if v.estado <> 'completada' then
    raise exception 'Esta factura ya está %', v.estado;
  end if;

  if exists (select 1 from devoluciones where venta_id = p_venta_id) then
    raise exception 'Esta factura tiene devoluciones registradas; no se puede anular desde aquí';
  end if;
  if exists (select 1 from deudas where venta_id = p_venta_id and coalesce(monto_pagado, 0) > 0) then
    raise exception 'Esta factura a fiado ya tiene abonos; no se puede anular desde aquí';
  end if;

  -- Devolver al inventario lo que se vendió
  update productos p
     set stock = p.stock + i.cantidad
    from (select producto_id, sum(cantidad) as cantidad
            from venta_items
           where venta_id = p_venta_id and producto_id is not null
           group by producto_id) i
   where p.id = i.producto_id;

  -- Quitar la deuda (fiado sin abonos) y recalcular el saldo del cliente
  delete from deudas where venta_id = p_venta_id;
  if v.cliente_id is not null then
    update clientes c
       set saldo_deuda = coalesce((select sum(d.saldo) from deudas d
                                    where d.cliente_id = v.cliente_id
                                      and d.estado in ('pendiente', 'parcial')), 0)
     where c.id = v.cliente_id;
  end if;

  update ventas set estado = 'anulada' where id = p_venta_id;

  insert into ventas_anuladas (venta_id, numero_factura, total, motivo, anulada_por, anulada_por_nombre, en_modo_soporte)
  values (p_venta_id, v.numero_factura, v.total, trim(p_motivo), p_usuario_id, p_usuario_nombre, coalesce(p_modo_soporte, false));

  return json_build_object('numero_factura', v.numero_factura, 'total', v.total);
end;
$$;

revoke all on function public.anular_venta(uuid, text, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.anular_venta(uuid, text, uuid, text, boolean) to service_role;
