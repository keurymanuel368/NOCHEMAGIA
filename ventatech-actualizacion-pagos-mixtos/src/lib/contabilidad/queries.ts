import "server-only";
import { createClient } from "@/lib/supabase/server";
import { fechaRD, rangoDiasRD } from "@/lib/fecha-rd";
import { abonosDelRango, gastosDelRango, ventasCompletadas } from "@/lib/ventas/movimientos";
import { sumarDesglose, totalTarjeta } from "@/lib/pagos";
import type { ResumenContable, Gasto } from "./types";

export async function getResumenContable(desde: string, hasta: string): Promise<ResumenContable> {
  const supabase = await createClient();
  const { desdeISO, hastaISO } = rangoDiasRD(desde, hasta);

  // Todas las filas del período (antes se cortaba en 1000 ventas) y las
  // ventas mixtas repartidas entre sus métodos.
  const rango = { desde: desdeISO, hasta: hastaISO };
  const [ventasRows, abonos, gastos, { data: items }] = await Promise.all([
    ventasCompletadas(supabase, rango),
    abonosDelRango(supabase, rango),
    gastosDelRango(supabase, rango),
    supabase
      .from("venta_items")
      .select("nombre_producto, cantidad, subtotal, ventas!inner(fecha, estado)")
      .gte("ventas.fecha", desdeISO)
      .lt("ventas.fecha", hastaISO)
      .eq("ventas.estado", "completada"),
  ]);

  const ventasTotal = ventasRows.reduce((s, v) => s + v.total, 0);
  const desglose = sumarDesglose(ventasRows);
  const porMetodo = {
    efectivo: desglose.efectivo,
    tarjeta: totalTarjeta(desglose),
    transferencia: desglose.transferencia,
    fiado: desglose.fiado,
  };
  const abonosCobrados = abonos.reduce((s, a) => s + a.monto, 0);
  const gastosTotal = gastos.reduce((s, g) => s + g.monto, 0);

  const gastosPorCatMap = new Map<string, number>();
  for (const g of gastos) {
    gastosPorCatMap.set(g.categoria_gasto, (gastosPorCatMap.get(g.categoria_gasto) ?? 0) + Number(g.monto));
  }
  const gastosPorCategoria = Array.from(gastosPorCatMap.entries())
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total);

  const porDiaMap = new Map<string, number>();
  for (const v of ventasRows) {
    const key = fechaRD(v.fecha); // día en hora de RD, no en UTC
    porDiaMap.set(key, (porDiaMap.get(key) ?? 0) + Number(v.total));
  }
  const ventasPorDia = Array.from(porDiaMap.entries())
    .map(([fecha, total]) => ({ fecha, total }))
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1));

  const topMap = new Map<string, { cantidad: number; monto: number }>();
  for (const it of items ?? []) {
    const actual = topMap.get(it.nombre_producto) ?? { cantidad: 0, monto: 0 };
    actual.cantidad += Number(it.cantidad);
    actual.monto += Number(it.subtotal);
    topMap.set(it.nombre_producto, actual);
  }
  const topProductos = Array.from(topMap.entries())
    .map(([nombre, v]) => ({ nombre, ...v }))
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 8);

  const ingresosReales = ventasTotal - porMetodo.fiado + abonosCobrados;
  const utilidad = ingresosReales - gastosTotal;

  return {
    ventasTotal,
    numVentas: ventasRows.length,
    porMetodo,
    abonosCobrados,
    gastosTotal,
    ingresosReales,
    utilidad,
    ventasPorDia,
    topProductos,
    gastosPorCategoria,
  };
}

export async function getGastos(desde: string, hasta: string): Promise<Gasto[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("gastos")
    .select("id, descripcion, categoria_gasto, monto, metodo_pago, fecha, notas, usuarios(nombre)")
    .eq("activo", true)
    .gte("fecha", rangoDiasRD(desde, hasta).desdeISO)
    .lt("fecha", rangoDiasRD(desde, hasta).hastaISO)
    .order("fecha", { ascending: false });

  return (data ?? []).map((g) => ({
    id: g.id,
    descripcion: g.descripcion,
    categoria_gasto: g.categoria_gasto,
    monto: Number(g.monto),
    metodo_pago: g.metodo_pago,
    usuario_nombre: (g.usuarios as unknown as { nombre: string } | null)?.nombre ?? "—",
    usuario_id: null,
    fecha: g.fecha,
    notas: g.notas,
  }));
}
