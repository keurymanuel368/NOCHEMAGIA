import "server-only";
import { createClient } from "@/lib/supabase/server";
import { traerTodas } from "@/lib/supabase/paginar";
import { fechaRD, hoyRD, inicioDiaRD, inicioMes, inicioMesAnterior, sumarDias } from "@/lib/fecha-rd";
import { ventasCompletadas, devolucionesDelRango, type Rango } from "@/lib/ventas/movimientos";
import { centavos, sumarDesglose, totalTarjeta } from "@/lib/pagos";

/** Turno de caja que define "el día" del dashboard. */
export type TurnoCaja = {
  abiertaAt: string;
  cerradaAt: string | null;
};

export type DashboardStats = {
  /** null si el negocio nunca ha abierto caja: entonces "hoy" es el día calendario. */
  turno: TurnoCaja | null;
  /** Venta neta del turno: facturado − devoluciones. Igual a "Venta neta" del cierre. */
  ventasHoyTotal: number;
  /** Facturado del turno antes de devoluciones ("Total vendido" del cierre). */
  ventasHoyBruto: number;
  ventasHoyDevoluciones: number;
  ventasHoyEfectivo: number;
  ventasHoyTarjeta: number;
  ventasHoyTransferencia: number;
  ventasHoyFiado: number;
  ventasHoyCount: number;
  ventasAyerTotal: number;
  /** Ventas netas del mes (facturado − devoluciones), todos los métodos. */
  ingresosMesTotal: number;
  /** Para revisar el número del mes: desde cuándo, cuántas ventas, cuánto es fiado y devoluciones. */
  mesDesde: string;
  ventasMesCount: number;
  ventasMesFiado: number;
  ventasMesDevoluciones: number;
  ingresosMesAnteriorTotal: number;
  deudasPendientesTotal: number;
  clientesConDeuda: number;
  productosBajos: number;
  productosAgotados: number;
  productosStockBajoNoAgotados: number;
  ticketPromedio: number;
  clientesAtendidosHoy: number;
};

export type VentaDia = { fecha: string; total: number };

export type UltimaVenta = {
  id: string;
  numero_factura: string;
  total: number;
  metodo_pago: string;
  fecha: string;
  cliente_nombre: string;
};

export type ProductoStockBajo = {
  id: string;
  nombre: string;
  categoria: string | null;
  stock: number;
  stock_minimo: number;
};

function inicioDeHoyISO() {
  return inicioDiaRD(hoyRD());
}

function inicioDeAyerISO() {
  return inicioDiaRD(sumarDias(hoyRD(), -1));
}

function inicioDeMesISO() {
  return inicioDiaRD(inicioMes(hoyRD()));
}

function inicioDeMesAnteriorISO() {
  return inicioDiaRD(inicioMesAnterior(hoyRD()));
}

/** Variación porcentual de `actual` respecto a `anterior`. */
export function calcularVariacionPct(actual: number, anterior: number): number {
  if (anterior <= 0) return actual > 0 ? 100 : 0;
  return ((actual - anterior) / anterior) * 100;
}

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

// "Las ventas del día" van de la apertura al cierre de la caja (p. ej. de
// 6:00 a. m. a 11:30 p. m.), no de medianoche a medianoche. Así el dashboard
// cuadra con el cierre de caja, que usa exactamente este mismo filtro
// (ventas completadas desde `abierta_at`).
// - Caja abierta: desde que se abrió hasta ahora.
// - Caja cerrada: el último turno completo, hasta que se abra la siguiente.
// - "Ayer" es el turno anterior.
async function getTurnos(supabase: SupabaseServer) {
  const { data } = await supabase
    .from("caja")
    .select("abierta_at, cerrada_at")
    .order("abierta_at", { ascending: false })
    .limit(2);
  const filas = data ?? [];
  const actual: TurnoCaja | null = filas[0]
    ? { abiertaAt: filas[0].abierta_at, cerradaAt: filas[0].cerrada_at }
    : null;
  const anterior: TurnoCaja | null = filas[1]
    ? { abiertaAt: filas[1].abierta_at, cerradaAt: filas[1].cerrada_at ?? filas[0].abierta_at }
    : null;
  return { actual, anterior };
}

/** Facturado, devoluciones y desglose por método de un rango. */
async function resumenVentas(supabase: SupabaseServer, rango: Rango, conPagos = false) {
  const [ventas, devoluciones] = await Promise.all([
    ventasCompletadas(supabase, rango, conPagos),
    devolucionesDelRango(supabase, rango),
  ]);
  const bruto = centavos(ventas.reduce((s, v) => s + v.total, 0));
  const devuelto = centavos(devoluciones.reduce((s, d) => s + d.total_devuelto, 0));
  return { ventas, bruto, devuelto, neto: centavos(bruto - devuelto) };
}

const SIN_VENTAS = { ventas: [], bruto: 0, devuelto: 0, neto: 0 };

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();
  const { actual: turno, anterior: turnoAnterior } = await getTurnos(supabase);

  // Mismo rango que el cierre de caja: de la apertura al cierre del turno.
  const rangoHoy: Rango = turno
    ? { desde: turno.abiertaAt, hasta: turno.cerradaAt, hastaIncluido: true }
    : { desde: inicioDeHoyISO(), hasta: null };
  const rangoAyer: Rango | null = turno
    ? turnoAnterior
      ? { desde: turnoAnterior.abiertaAt, hasta: turnoAnterior.cerradaAt, hastaIncluido: true }
      : null
    : { desde: inicioDeAyerISO(), hasta: inicioDeHoyISO() };

  const [hoy, ayer, mes, mesAnterior, clientes, productos] = await Promise.all([
    resumenVentas(supabase, rangoHoy, true),
    rangoAyer ? resumenVentas(supabase, rangoAyer) : Promise.resolve(SIN_VENTAS),
    resumenVentas(supabase, { desde: inicioDeMesISO(), hasta: null }),
    resumenVentas(supabase, { desde: inicioDeMesAnteriorISO(), hasta: inicioDeMesISO() }),
    // Deudas pendientes desde las deudas mismas (igual que la pantalla de
    // Fiado), no desde el saldo guardado en cada cliente, que podía diferir.
    traerTodas((a, b) =>
      supabase
        .from("deudas")
        .select("cliente_id, saldo")
        .in("estado", ["pendiente", "parcial"])
        .order("id")
        .range(a, b)
    ),
    traerTodas((a, b) =>
      supabase.from("productos").select("id, stock, stock_minimo").eq("activo", true).order("id").range(a, b)
    ),
  ]);

  const desgloseHoy = sumarDesglose(hoy.ventas);
  const ventasHoyCount = hoy.ventas.length;
  // Una atención por cada venta, no por cliente distinto: si el mismo
  // cliente (o "Cliente general") compra varias veces, cada compra cuenta.
  const clientesAtendidosHoy = ventasHoyCount;

  const deudaRows = clientes.data ?? [];
  const deudasPendientesTotal = centavos(deudaRows.reduce((s, d) => s + Number(d.saldo), 0));
  const clientesConDeuda = new Set(deudaRows.map((d) => d.cliente_id)).size;

  const productosRows = productos.data ?? [];
  const productosAgotados = productosRows.filter((p) => Number(p.stock) <= 0).length;
  const productosStockBajoNoAgotados = productosRows.filter(
    (p) => Number(p.stock) > 0 && Number(p.stock) <= Number(p.stock_minimo)
  ).length;

  return {
    turno,
    ventasHoyTotal: hoy.neto,
    ventasHoyBruto: hoy.bruto,
    ventasHoyDevoluciones: hoy.devuelto,
    ventasHoyEfectivo: desgloseHoy.efectivo,
    ventasHoyTarjeta: totalTarjeta(desgloseHoy),
    ventasHoyTransferencia: desgloseHoy.transferencia,
    ventasHoyFiado: desgloseHoy.fiado,
    ventasHoyCount,
    ventasAyerTotal: ayer.neto,
    ingresosMesTotal: mes.neto,
    mesDesde: inicioMes(hoyRD()),
    ventasMesCount: mes.ventas.length,
    ventasMesFiado: centavos(mes.ventas.filter((v) => v.metodo_pago === "fiado").reduce((s, v) => s + v.total, 0)),
    ventasMesDevoluciones: mes.devuelto,
    ingresosMesAnteriorTotal: mesAnterior.neto,
    deudasPendientesTotal,
    clientesConDeuda,
    productosBajos: productosAgotados + productosStockBajoNoAgotados,
    productosAgotados,
    productosStockBajoNoAgotados,
    ticketPromedio: ventasHoyCount > 0 ? centavos(hoy.bruto / ventasHoyCount) : 0,
    clientesAtendidosHoy,
  };
}

export async function getVentasUltimosDias(dias: number): Promise<VentaDia[]> {
  const supabase = await createClient();
  const desde = sumarDias(hoyRD(), -(dias - 1));
  const { ventas, devoluciones } = await ventasYDevoluciones(supabase, inicioDiaRD(desde));

  const porDia = new Map<string, number>();
  for (let i = 0; i < dias; i++) {
    porDia.set(sumarDias(desde, i), 0);
  }
  for (const v of ventas) {
    const key = fechaRD(v.fecha);
    if (porDia.has(key)) porDia.set(key, (porDia.get(key) ?? 0) + v.total);
  }
  // Las devoluciones se restan el día en que se hicieron.
  for (const d of devoluciones) {
    const key = fechaRD(d.fecha);
    if (porDia.has(key)) porDia.set(key, (porDia.get(key) ?? 0) - d.total_devuelto);
  }

  return Array.from(porDia.entries()).map(([fecha, total]) => ({ fecha, total: centavos(total) }));
}

async function ventasYDevoluciones(supabase: SupabaseServer, desdeISO: string) {
  const rango: Rango = { desde: desdeISO, hasta: null };
  const [ventas, devoluciones] = await Promise.all([
    ventasCompletadas(supabase, rango, false),
    devolucionesDelRango(supabase, rango),
  ]);
  return { ventas, devoluciones };
}

export async function getUltimasVentas(limit = 8): Promise<UltimaVenta[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ventas")
    .select("id, numero_factura, total, metodo_pago, fecha, clientes(nombre)")
    .order("fecha", { ascending: false })
    .limit(limit);

  return (data ?? []).map((v) => ({
    id: v.id,
    numero_factura: v.numero_factura,
    total: Number(v.total),
    metodo_pago: v.metodo_pago,
    fecha: v.fecha,
    cliente_nombre: (v.clientes as unknown as { nombre: string } | null)?.nombre ?? "Cliente General",
  }));
}

export type MesComparativo = { mes: string; esteAnio: number; anioPasado: number };

const MESES_CORTOS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

export async function getComparativaAnual(): Promise<MesComparativo[]> {
  const supabase = await createClient();
  // Año y mes en hora de RD (el servidor está en UTC: una venta del 31 a las
  // 9:00 p. m. caía en el mes siguiente).
  const hoy = hoyRD();
  const anioActual = Number(hoy.slice(0, 4));
  const { ventas, devoluciones } = await ventasYDevoluciones(supabase, inicioDiaRD(`${anioActual - 1}-01-01`));

  const porMes = new Map<string, number>();
  const sumar = (fecha: string, monto: number) => {
    const dia = fechaRD(fecha);
    const key = `${Number(dia.slice(0, 4))}-${Number(dia.slice(5, 7)) - 1}`;
    porMes.set(key, (porMes.get(key) ?? 0) + monto);
  };
  for (const v of ventas) sumar(v.fecha, v.total);
  for (const d of devoluciones) sumar(d.fecha, -d.total_devuelto);

  return MESES_CORTOS.map((mes, i) => ({
    mes,
    esteAnio: centavos(porMes.get(`${anioActual}-${i}`) ?? 0),
    anioPasado: centavos(porMes.get(`${anioActual - 1}-${i}`) ?? 0),
  }));
}

export async function getStockBajo(limit = 8): Promise<ProductoStockBajo[]> {
  const supabase = await createClient();
  // Se revisan todos los productos (antes solo los 50 con menos existencia:
  // un producto con stock alto pero mínimo más alto no salía).
  const { data } = await traerTodas((a, b) =>
    supabase
      .from("productos")
      .select("id, nombre, categoria, stock, stock_minimo")
      .eq("activo", true)
      .order("stock", { ascending: true })
      .order("id", { ascending: true })
      .range(a, b)
  );

  return data
    .filter((p) => Number(p.stock) <= Number(p.stock_minimo))
    .slice(0, limit);
}
