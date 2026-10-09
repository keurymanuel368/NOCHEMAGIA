-- ============================================================
-- Diagnóstico: ¿de dónde salen las "Ventas del mes"?
-- Pegar en Supabase > SQL Editor > Run. SOLO LEE, no cambia nada.
-- OJO: el SQL Editor ve TODAS las empresas (no aplica permisos).
-- ============================================================

-- 1) Ventas del mes por empresa (vía el cajero que hizo la venta).
--    Si sale más de una fila, compara con la de tu negocio.
select u.empresa_id,
       count(*)              as ventas,
       sum(v.total)          as total
from public.ventas v
left join public.usuarios u on u.id = v.usuario_id
where v.estado = 'completada'
  and v.fecha >= date_trunc('month', now() at time zone 'America/Santo_Domingo')
                 at time zone 'America/Santo_Domingo'
group by u.empresa_id
order by total desc;

-- 2) Ventas del mes por día y método (hora de RD).
--    Busca días con montos raros.
select (v.fecha at time zone 'America/Santo_Domingo')::date as dia,
       v.metodo_pago,
       count(*)     as ventas,
       sum(v.total) as total
from public.ventas v
where v.estado = 'completada'
  and v.fecha >= date_trunc('month', now() at time zone 'America/Santo_Domingo')
                 at time zone 'America/Santo_Domingo'
group by 1, 2
order by 1, 2;

-- 3) Las 20 ventas más grandes del mes (ventas de prueba, montos mal escritos...).
select v.numero_factura, v.fecha at time zone 'America/Santo_Domingo' as fecha_rd,
       v.total, v.metodo_pago
from public.ventas v
where v.estado = 'completada'
  and v.fecha >= date_trunc('month', now() at time zone 'America/Santo_Domingo')
                 at time zone 'America/Santo_Domingo'
order by v.total desc
limit 20;

-- 4) Facturas repetidas (misma factura guardada dos veces).
select v.numero_factura, count(*) as veces, sum(v.total) as total
from public.ventas v
where v.fecha >= date_trunc('month', now() at time zone 'America/Santo_Domingo')
                 at time zone 'America/Santo_Domingo'
group by v.numero_factura
having count(*) > 1;
