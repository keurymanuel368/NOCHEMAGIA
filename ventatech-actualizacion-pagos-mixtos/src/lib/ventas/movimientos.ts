import "server-only";
import { createClient } from "@/lib/supabase/server";
import { traerTodas } from "@/lib/supabase/paginar";
import {
  calcularCuadre,
  type AbonoMov,
  type CuadreTurno,
  type DevolucionMov,
  type GastoMov,
  type VentaMov,
} from "@/lib/caja/cuadre";

export type { AbonoMov, CuadreTurno, DevolucionMov, GastoMov, VentaMov } from "@/lib/caja/cuadre";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

type Resultado<T> = { data: T[] | null; error: { message: string } | null };

/** Rango de tiempo: `hasta` null = hasta ahora. */
export type Rango = { desde: string; hasta: string | null; hastaIncluido?: boolean };

/** Ventas completadas del rango, con el desglose de pagos si existe. */
export async function ventasCompletadas(
  supabase: SupabaseServer,
  rango: Rango,
  conPagos = true
): Promise<VentaMov[]> {
  const consultar = (columnas: string) =>
    traerTodas<VentaMov>((a, b) => {
      let q = supabase.from("ventas").select(columnas).eq("estado", "completada").gte("fecha", rango.desde);
      if (rango.hasta) q = rango.hastaIncluido ? q.lte("fecha", rango.hasta) : q.lt("fecha", rango.hasta);
      return q.order("fecha", { ascending: true }).order("id", { ascending: true }).range(a, b) as unknown as PromiseLike<
        Resultado<VentaMov>
      >;
    });

  let res = conPagos
    ? await consultar("total, metodo_pago, fecha, venta_pagos(metodo, tipo_tarjeta, monto)")
    : await consultar("total, metodo_pago, fecha");
  if (res.error && conPagos) {
    // Si todavía no se ejecutó el SQL de pagos mixtos, la tabla no existe:
    // se sigue funcionando como antes, sin desglose.
    res = await consultar("total, metodo_pago, fecha");
  }
  return res.data.map((v) => ({
    total: Number(v.total),
    metodo_pago: v.metodo_pago,
    fecha: v.fecha,
    venta_pagos: v.venta_pagos ?? null,
  }));
}

/**
 * Devoluciones del rango. Solo cuentan las de ventas que siguen
 * "completadas": si una devolución total cambia el estado de la venta, esa
 * venta ya no suma, y restar la devolución sería descontarla dos veces.
 */
export async function devolucionesDelRango(supabase: SupabaseServer, rango: Rango): Promise<DevolucionMov[]> {
  const consultar = (columnas: string, conFiltro: boolean) =>
    traerTodas<DevolucionMov>((a, b) => {
      let q = supabase.from("devoluciones").select(columnas).gte("fecha", rango.desde);
      if (conFiltro) q = q.eq("ventas.estado", "completada");
      if (rango.hasta) q = rango.hastaIncluido ? q.lte("fecha", rango.hasta) : q.lt("fecha", rango.hasta);
      return q.order("fecha", { ascending: true }).order("id", { ascending: true }).range(a, b) as unknown as PromiseLike<
        Resultado<DevolucionMov>
      >;
    });

  let res = await consultar("total_devuelto, metodo_devolucion, fecha, ventas!inner(estado)", true);
  if (res.error) res = await consultar("total_devuelto, metodo_devolucion, fecha", false);
  return res.data.map((d) => ({
    total_devuelto: Number(d.total_devuelto),
    metodo_devolucion: d.metodo_devolucion,
    fecha: d.fecha,
  }));
}

export async function abonosDelRango(supabase: SupabaseServer, rango: Rango): Promise<AbonoMov[]> {
  const res = await traerTodas<AbonoMov>((a, b) => {
    let q = supabase.from("abonos").select("monto, metodo_pago, fecha").gte("fecha", rango.desde);
    if (rango.hasta) q = rango.hastaIncluido ? q.lte("fecha", rango.hasta) : q.lt("fecha", rango.hasta);
    return q.order("fecha", { ascending: true }).order("id", { ascending: true }).range(a, b) as unknown as PromiseLike<
      Resultado<AbonoMov>
    >;
  });
  return res.data.map((x) => ({ monto: Number(x.monto), metodo_pago: x.metodo_pago, fecha: x.fecha }));
}

export async function gastosDelRango(supabase: SupabaseServer, rango: Rango): Promise<GastoMov[]> {
  const res = await traerTodas<GastoMov>((a, b) => {
    let q = supabase
      .from("gastos")
      .select("monto, metodo_pago, fecha, categoria_gasto")
      .eq("activo", true)
      .gte("fecha", rango.desde);
    if (rango.hasta) q = rango.hastaIncluido ? q.lte("fecha", rango.hasta) : q.lt("fecha", rango.hasta);
    return q.order("fecha", { ascending: true }).order("id", { ascending: true }).range(a, b) as unknown as PromiseLike<
      Resultado<GastoMov>
    >;
  });
  return res.data.map((x) => ({
    monto: Number(x.monto),
    metodo_pago: x.metodo_pago,
    fecha: x.fecha,
    categoria_gasto: x.categoria_gasto,
  }));
}

/** Trae y calcula todos los movimientos de un rango (un turno de caja). */
export async function cuadreDelRango(supabase: SupabaseServer, rango: Rango): Promise<CuadreTurno> {
  const [ventas, devoluciones, abonos, gastos] = await Promise.all([
    ventasCompletadas(supabase, rango),
    devolucionesDelRango(supabase, rango),
    abonosDelRango(supabase, rango),
    gastosDelRango(supabase, rango),
  ]);
  return calcularCuadre({ ventas, devoluciones, abonos, gastos });
}
