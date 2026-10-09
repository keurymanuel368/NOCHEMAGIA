-- ============================================================
-- VentaTech: cierre de caja guardado (no cambia después)
-- Pegar en Supabase > SQL Editor > Run (una sola vez; se puede repetir).
--
-- Al cerrar la caja se guarda una "foto" del cuadre: lo vendido por método,
-- abonos, devoluciones, gastos, el efectivo esperado, lo contado y la
-- diferencia. El historial muestra esa foto, así un turno cerrado ya no
-- cambia solo si después se anula una venta o se borra un gasto. Si algo
-- cambió después, el historial lo indica aparte.
-- ============================================================

create table if not exists public.caja_cierres (
  caja_id uuid primary key references public.caja(id) on delete cascade,
  abierta_at timestamptz not null,
  cerrada_at timestamptz not null,
  monto_inicial numeric(12, 2) not null,
  efectivo_esperado numeric(12, 2) not null,
  monto_contado numeric(12, 2) not null,
  diferencia numeric(12, 2) not null,
  cuadre jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.caja_cierres enable row level security;
drop policy if exists caja_cierres_select on public.caja_cierres;
create policy caja_cierres_select on public.caja_cierres
  for select to authenticated
  using (exists (select 1 from public.caja c where c.id = caja_cierres.caja_id));
revoke insert, update, delete on public.caja_cierres from anon, authenticated;
grant select on public.caja_cierres to authenticated;
grant all on public.caja_cierres to service_role;
