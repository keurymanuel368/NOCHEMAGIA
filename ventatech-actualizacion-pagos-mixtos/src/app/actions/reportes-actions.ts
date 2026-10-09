"use server";

import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/get-usuario-actual";
import { traerTodas } from "@/lib/supabase/paginar";
import { rangoDiasRD, ZONA_NEGOCIO } from "@/lib/fecha-rd";
import { abonosDelRango, devolucionesDelRango, gastosDelRango, ventasCompletadas } from "@/lib/ventas/movimientos";
import { sumarDesglose } from "@/lib/pagos";

export type ReporteResultado = { columns: string[]; rows: (string | number)[][] };

async function requireReportes() {
  const actual = await getUsuarioActual();
  if (!actual || !(actual.es_admin || actual.perm_reportes)) {
    throw new Error("Sin permiso para ver reportes");
  }
}

// Días completos en hora de RD; filtrar con .gte(desdeISO) y .lt(hastaISO).
const rango = rangoDiasRD;

export async function reporteVentasAction(desde: string, hasta: string): Promise<ReporteResultado> {
  await requireReportes();
  const supabase = await createClient();
  const { desdeISO, hastaISO } = rango(desde, hasta);
  const { data } = await traerTodas((a, b) =>
    supabase
      .from("ventas")
      .select("numero_factura, fecha, total, metodo_pago, estado, clientes(nombre), usuarios(nombre)")
      .gte("fecha", desdeISO)
      .lt("fecha", hastaISO)
      .order("fecha", { ascending: false })
      .order("id", { ascending: false })
      .range(a, b)
  );

  return {
    columns: ["Factura", "Fecha", "Cliente", "Total", "Método", "Estado", "Cajero"],
    rows: (data ?? []).map((v) => [
      v.numero_factura,
      new Date(v.fecha).toLocaleString("es-DO", { timeZone: ZONA_NEGOCIO }),
      (v.clientes as unknown as { nombre: string } | null)?.nombre ?? "Cliente General",
      Number(v.total).toFixed(2),
      v.metodo_pago,
      v.estado,
      (v.usuarios as unknown as { nombre: string } | null)?.nombre ?? "—",
    ]),
  };
}

export async function reporteInventarioAction(): Promise<ReporteResultado> {
  await requireReportes();
  const supabase = await createClient();
  const { data } = await traerTodas((a, b) =>
    supabase
      .from("productos")
      .select("codigo_barras, nombre, precio_compra, precio_venta, stock, stock_minimo, categorias(nombre)")
      .eq("activo", true)
      .order("nombre", { ascending: true })
      .order("id", { ascending: true })
      .range(a, b)
  );

  return {
    columns: ["Código", "Producto", "Categoría", "Costo", "P. Venta", "Stock", "Stock Mínimo"],
    rows: (data ?? []).map((p) => [
      p.codigo_barras ?? "",
      p.nombre,
      (p.categorias as unknown as { nombre: string } | null)?.nombre ?? "",
      Number(p.precio_compra).toFixed(2),
      Number(p.precio_venta).toFixed(2),
      Number(p.stock).toFixed(2),
      Number(p.stock_minimo).toFixed(2),
    ]),
  };
}

export async function reporteClientesDeudasAction(): Promise<ReporteResultado> {
  await requireReportes();
  const supabase = await createClient();
  const { data } = await traerTodas((a, b) =>
    supabase
      .from("clientes")
      .select("nombre, cedula, telefono, saldo_deuda")
      .gt("saldo_deuda", 0)
      .eq("activo", true)
      .order("saldo_deuda", { ascending: false })
      .order("id", { ascending: true })
      .range(a, b)
  );

  return {
    columns: ["Cliente", "Cédula", "Teléfono", "Deuda"],
    rows: (data ?? []).map((c) => [c.nombre, c.cedula ?? "", c.telefono ?? "", Number(c.saldo_deuda).toFixed(2)]),
  };
}

export async function reporteGastosAction(desde: string, hasta: string): Promise<ReporteResultado> {
  await requireReportes();
  const supabase = await createClient();
  const { desdeISO, hastaISO } = rango(desde, hasta);
  const { data } = await traerTodas((a, b) =>
    supabase
      .from("gastos")
      .select("descripcion, categoria_gasto, monto, metodo_pago, fecha, usuarios(nombre)")
      .eq("activo", true)
      .gte("fecha", desdeISO)
      .lt("fecha", hastaISO)
      .order("fecha", { ascending: false })
      .order("id", { ascending: false })
      .range(a, b)
  );

  return {
    columns: ["Descripción", "Categoría", "Monto", "Método", "Fecha", "Usuario"],
    rows: (data ?? []).map((g) => [
      g.descripcion,
      g.categoria_gasto,
      Number(g.monto).toFixed(2),
      g.metodo_pago,
      new Date(g.fecha).toLocaleString("es-DO", { timeZone: ZONA_NEGOCIO }),
      (g.usuarios as unknown as { nombre: string } | null)?.nombre ?? "—",
    ]),
  };
}

export async function reporteAbonosAction(desde: string, hasta: string): Promise<ReporteResultado> {
  await requireReportes();
  const supabase = await createClient();
  const { desdeISO, hastaISO } = rango(desde, hasta);
  const { data } = await traerTodas((a, b) =>
    supabase
      .from("abonos")
      .select("monto, metodo_pago, fecha, notas, clientes(nombre), usuarios(nombre)")
      .gte("fecha", desdeISO)
      .lt("fecha", hastaISO)
      .order("fecha", { ascending: false })
      .order("id", { ascending: false })
      .range(a, b)
  );

  return {
    columns: ["Cliente", "Monto", "Método", "Fecha", "Cajero", "Notas"],
    rows: (data ?? []).map((a) => [
      (a.clientes as unknown as { nombre: string } | null)?.nombre ?? "—",
      Number(a.monto).toFixed(2),
      a.metodo_pago,
      new Date(a.fecha).toLocaleString("es-DO", { timeZone: ZONA_NEGOCIO }),
      (a.usuarios as unknown as { nombre: string } | null)?.nombre ?? "—",
      a.notas ?? "",
    ]),
  };
}

export async function reporteResumenEjecutivoAction(desde: string, hasta: string): Promise<ReporteResultado> {
  await requireReportes();
  const supabase = await createClient();
  const { desdeISO, hastaISO } = rango(desde, hasta);

  // Todas las filas del período (Supabase corta cada consulta en 1000).
  const periodo = { desde: desdeISO, hasta: hastaISO };
  const [ventas, abonos, gastos, devoluciones] = await Promise.all([
    ventasCompletadas(supabase, periodo),
    abonosDelRango(supabase, periodo),
    gastosDelRango(supabase, periodo),
    devolucionesDelRango(supabase, periodo),
  ]);

  const desglose = sumarDesglose(ventas);
  const ventasTotal = ventas.reduce((s, v) => s + v.total, 0);
  const fiadoTotal = desglose.fiado;
  const abonosTotal = abonos.reduce((s, a) => s + a.monto, 0);
  const gastosTotal = gastos.reduce((s, g) => s + g.monto, 0);
  const devolucionesEfectivo = devoluciones
    .filter((d) => d.metodo_devolucion === "efectivo")
    .reduce((s, d) => s + d.total_devuelto, 0);
  const ingresosReales = ventasTotal - fiadoTotal + abonosTotal - devolucionesEfectivo;
  const utilidad = ingresosReales - gastosTotal;

  return {
    columns: ["Concepto", "Monto"],
    rows: [
      ["Ventas totales", ventasTotal.toFixed(2)],
      ["  Efectivo", desglose.efectivo.toFixed(2)],
      ["  Tarjeta débito", desglose.tarjeta_debito.toFixed(2)],
      ["  Tarjeta crédito", desglose.tarjeta_credito.toFixed(2)],
      ...(desglose.tarjeta !== 0 ? [["  Tarjeta (sin tipo)", desglose.tarjeta.toFixed(2)]] : []),
      ["  Transferencia", desglose.transferencia.toFixed(2)],
      ["Ventas a fiado", fiadoTotal.toFixed(2)],
      ["Abonos cobrados", abonosTotal.toFixed(2)],
      ["Devoluciones pagadas en efectivo", (-devolucionesEfectivo).toFixed(2)],
      ["Ingresos reales", ingresosReales.toFixed(2)],
      ["Gastos totales", gastosTotal.toFixed(2)],
      ["Utilidad", utilidad.toFixed(2)],
    ],
  };
}
