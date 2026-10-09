-- ============================================================
-- VentaTech: velocidad y protección contra facturas duplicadas
-- Pegar en Supabase > SQL Editor > Run. Se puede ejecutar más de una vez.
-- No borra ni cambia datos: solo crea índices y una regla de unicidad.
-- ============================================================

-- 1) Índices para las consultas más usadas (POS, caja, dashboard, reportes).
--    Cada índice se crea solo si la tabla y las columnas existen.
do $$
declare
  idx record;
  faltan int;
begin
  for idx in
    select * from (values
      ('ventas_fecha_idx',            'ventas',          array['fecha']),
      ('ventas_estado_fecha_idx',     'ventas',          array['estado', 'fecha']),
      ('venta_items_venta_idx',       'venta_items',     array['venta_id']),
      ('venta_pagos_venta_idx',       'venta_pagos',     array['venta_id']),
      ('devoluciones_fecha_idx',      'devoluciones',    array['fecha']),
      ('devoluciones_venta_idx',      'devoluciones',    array['venta_id']),
      ('abonos_fecha_idx',            'abonos',          array['fecha']),
      ('gastos_activo_fecha_idx',     'gastos',          array['activo', 'fecha']),
      ('deudas_estado_fecha_idx',     'deudas',          array['estado', 'fecha']),
      ('deudas_venta_idx',            'deudas',          array['venta_id']),
      ('productos_activo_nombre_idx', 'productos',       array['activo', 'nombre']),
      ('clientes_activo_nombre_idx',  'clientes',        array['activo', 'nombre']),
      ('caja_estado_abierta_idx',     'caja',            array['estado', 'abierta_at'])
    ) as t(nombre, tabla, columnas)
  loop
    select count(*) into faltan
    from unnest(idx.columnas) as c(col)
    where not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = idx.tabla and column_name = c.col);
    if to_regclass('public.' || idx.tabla) is not null and faltan = 0 then
      execute format('create index if not exists %I on public.%I (%s)',
        idx.nombre, idx.tabla,
        (select string_agg(format('%I', c), ', ') from unnest(idx.columnas) c));
    else
      raise notice 'Índice % omitido (no existe la tabla o alguna columna)', idx.nombre;
    end if;
  end loop;
end $$;

-- 2) Una venta por código de cobro: si el POS manda la misma venta dos veces
--    (doble clic, internet lento, sincronización offline), la base de datos
--    rechaza la segunda en vez de guardar una factura repetida.
do $$
declare
  repetidas int;
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'ventas' and column_name = 'local_id') then
    raise notice 'ventas.local_id no existe: se omite la regla de unicidad';
    return;
  end if;

  select count(*) into repetidas from (
    select local_id from public.ventas where local_id is not null
    group by local_id having count(*) > 1) d;

  if repetidas > 0 then
    raise notice 'Hay % códigos de cobro repetidos (facturas duplicadas). Revísalas con la consulta 3 y anúlalas; luego vuelve a ejecutar este archivo.', repetidas;
  else
    create unique index if not exists ventas_local_id_unico on public.ventas (local_id) where local_id is not null;
  end if;
end $$;

-- 3) CONSULTA (solo lectura): posibles facturas duplicadas de los últimos 30 días.
--    Mismo total y mismos productos, cobradas con menos de 3 minutos de diferencia.
--    OJO: el SQL Editor ve todas las empresas.
with firmas as (
  select v.id, v.numero_factura, v.fecha, v.total, v.estado,
         (select string_agg(i.nombre_producto || ' x' || i.cantidad, ', ' order by i.nombre_producto, i.cantidad)
            from public.venta_items i where i.venta_id = v.id) as productos
  from public.ventas v
  where v.fecha >= now() - interval '30 days' and v.estado = 'completada'
)
select a.numero_factura as factura_original,
       b.numero_factura as posible_duplicado,
       a.fecha at time zone 'America/Santo_Domingo' as fecha_original,
       b.fecha at time zone 'America/Santo_Domingo' as fecha_duplicado,
       a.total, a.productos
from firmas a
join firmas b
  on b.total = a.total
 and b.productos = a.productos
 and b.fecha > a.fecha
 and b.fecha <= a.fecha + interval '3 minutes'
order by a.fecha desc;
