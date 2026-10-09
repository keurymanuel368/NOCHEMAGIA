import "server-only";
import { createClient } from "@/lib/supabase/server";
import { traerTodas } from "@/lib/supabase/paginar";
import { fechaRD, rangoDiasRD } from "@/lib/fecha-rd";
import { abonosDelRango, devolucionesDelRango, gastosDelRango, ventasCompletadas } from "@/lib/ventas/movimientos";
import { centavos, sumarDesglose, totalTarjeta } from "@/lib/pagos";
import type { ResumenContable, Gasto } from "./types";

export async function getResumenContable(desde: string, hasta: string): Promise<ResumenContable> {
  const supabase = await createClient();
  const { desdeISO, hastaISO } = rangoDiasRD(desde, hasta);

  // Todas las filas del período (antes se cortaba en 1000 ventas) y las
  // ventas mixtas repartidas entre sus métodos.
  const rango = { desde: desdeISO, hasta: hastaISO };
  const [ventasRows, abonos, gastos, { data: items }, devoluciones] = await Promise.all([
    ventasCompletadas(supabase, rango),
    abonosDelRango(supabase, rango),
    gastosDelRango(supabase, rango),
    // Productos de todas las ventas del período: se pagina por venta (cada
    // venta trae todos sus productos), así no se corta en 1000 filas.
    traerTodas((a, b) =>
      supabase
        .from("ventas")
        .select("venta_items(nombre_producto, cantidad, subtotal)")
        .eq("estado", "completada")
        .gte("fecha", desdeISO)
        .lt("fecha", hastaISO)
        .order("fecha", { ascending: true })
        .order("id", { ascending: true })
        .range(a, b)
    ).then((r) => ({
      data: r.data.flatMap(
        (v) => (v.venta_items ?? []) as { nombre_producto: string; cantidad: number; subtotal: number }[]
      ),
    })),
    devolucionesDelRango(supabase, rango),
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

  // Mismas reglas que el cierre de caja: las devoluciones pagadas en efectivo
  // son dinero que salió; antes no se restaban y Contabilidad mostraba más
  // de lo que realmente entró.
  const devolucionesTotal = centavos(devoluciones.reduce((s, d) => s + d.total_devuelto, 0));
  const devolucionesEfectivo = centavos(
    devoluciones.filter((d) => d.metodo_devolucion === "efectivo").reduce((s, d) => s + d.total_devuelto, 0)
  );
  const ingresosReales = centavos(ventasTotal - porMetodo.fiado + abonosCobrados - devolucionesEfectivo);
  const utilidad = centavos(ingresosReales - gastosTotal);

  return {
    ventasTotal: centavos(ventasTotal),
    numVentas: ventasRows.length,
    porMetodo,
    abonosCobrados: centavos(abonosCobrados),
    devolucionesTotal,
    devolucionesEfectivo,
    gastosTotal: centavos(gastosTotal),
    ingresosReales,
    utilidad,
    ventasPorDia,
    topProductos,
    gastosPorCategoria,
  };
}

export async function getGastos(desde: string, hasta: string): Promise<Gasto[]> {
  const supabase = await createClient();
  const { data } = await traerTodas((a, b) =>
    supabase
      .from("gastos")
      .select("id, descripcion, categoria_gasto, monto, metodo_pago, fecha, notas, usuarios(nombre)")
      .eq("activo", true)
      .gte("fecha", rangoDiasRD(desde, hasta).desdeISO)
      .lt("fecha", rangoDiasRD(desde, hasta).hastaISO)
      .order("fecha", { ascending: false })
      .order("id", { ascending: false })
      .range(a, b)
  );

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
