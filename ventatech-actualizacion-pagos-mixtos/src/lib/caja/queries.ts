import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  abonosDelRango,
  cuadreDelRango,
  devolucionesDelRango,
  gastosDelRango,
  ventasCompletadas,
} from "@/lib/ventas/movimientos";
import { calcularCuadre, type CuadreTurno } from "./cuadre";
import { centavos } from "@/lib/pagos";

export type { CuadreTurno } from "./cuadre";

export type CajaSesion = {
  id: string;
  cajero_nombre: string;
  monto_inicial: number;
  monto_final: number | null;
  estado: "abierta" | "cerrada";
  abierta_at: string;
  cerrada_at: string | null;
  /** Todo el movimiento del turno: ventas por método, abonos, devoluciones y gastos. */
  cuadre: CuadreTurno;
  /** Monto inicial + efectivo neto del turno: lo que debe haber en la gaveta. */
  efectivo_esperado: number;
  /** Contado − esperado (positivo = sobrante, negativo = faltante). null si sigue abierta. */
  diferencia: number | null;
  /** true si el cuadre viene de la foto guardada al cerrar (no se recalcula). */
  cierre_guardado: boolean;
  /**
   * Lo que cambió en este turno DESPUÉS de cerrarlo (ventas anuladas, gastos
   * borrados, ventas offline que llegaron tarde...). null si no cambió nada.
   */
  cambios_posteriores: { ventas: number; efectivo: number } | null;
  // Campos de antes, se mantienen para no romper nada.
  ventas_efectivo: number;
  num_ventas: number;
  ventas_total: number;
  ventas_por_metodo: Record<string, number>;
};

type FilaCaja = {
  id: string;
  monto_inicial: number | string;
  monto_final: number | string | null;
  estado: "abierta" | "cerrada";
  abierta_at: string;
  cerrada_at: string | null;
  usuarios: unknown;
};

function armarSesion(c: FilaCaja, cuadre: CuadreTurno): CajaSesion {
  const montoInicial = Number(c.monto_inicial);
  const montoFinal = c.monto_final === null ? null : Number(c.monto_final);
  const esperado = centavos(montoInicial + cuadre.efectivoNeto);
  const porMetodo: Record<string, number> = {};
  for (const [clave, monto] of Object.entries(cuadre.desglose)) if (monto !== 0) porMetodo[clave] = monto;

  return {
    id: c.id,
    cajero_nombre: (c.usuarios as { nombre: string } | null)?.nombre ?? "—",
    monto_inicial: montoInicial,
    monto_final: montoFinal,
    estado: c.estado,
    abierta_at: c.abierta_at,
    cerrada_at: c.cerrada_at,
    cuadre,
    efectivo_esperado: esperado,
    diferencia: montoFinal === null || c.estado === "abierta" ? null : centavos(montoFinal - esperado),
    cierre_guardado: false,
    cambios_posteriores: null,
    ventas_efectivo: cuadre.desglose.efectivo,
    num_ventas: cuadre.numVentas,
    ventas_total: cuadre.ventasTotal,
    ventas_por_metodo: porMetodo,
  };
}

const COLUMNAS_CAJA = "id, monto_inicial, monto_final, estado, abierta_at, cerrada_at, usuarios(nombre)";

export async function getCajaActual(): Promise<CajaSesion | null> {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("caja")
    .select(COLUMNAS_CAJA)
    .eq("estado", "abierta")
    .order("abierta_at", { ascending: false })
    .limit(1);

  const data = (rows?.[0] ?? null) as FilaCaja | null;
  if (!data) return null;

  const cuadre = await cuadreDelRango(supabase, { desde: data.abierta_at, hasta: null });
  return armarSesion(data, cuadre);
}

export async function getCajaHistorial(limit = 30): Promise<CajaSesion[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("caja")
    .select(COLUMNAS_CAJA)
    .order("abierta_at", { ascending: false })
    .limit(limit);

  const cajas = (data ?? []) as FilaCaja[];
  if (cajas.length === 0) return [];

  // Se traen todos los movimientos desde la caja más vieja de la lista una
  // sola vez y se reparten por turno, en vez de hacer 4 consultas por caja.
  const desde = cajas[cajas.length - 1].abierta_at;
  const rango = { desde, hasta: null };
  const [ventas, devoluciones, abonos, gastos] = await Promise.all([
    ventasCompletadas(supabase, rango),
    devolucionesDelRango(supabase, rango),
    abonosDelRango(supabase, rango),
    gastosDelRango(supabase, rango),
  ]);

  // Fotos guardadas al cerrar (si ya se ejecutó cierres-de-caja.sql).
  const { data: fotos } = await supabase
    .from("caja_cierres")
    .select("caja_id, efectivo_esperado, monto_contado, diferencia, cuadre")
    .in("caja_id", cajas.map((c) => c.id));
  const fotoPorCaja = new Map((fotos ?? []).map((f) => [f.caja_id as string, f]));

  // Un turno sin cerrar que no es el último (caja que se quedó abierta y se
  // abrió otra) termina donde empieza el siguiente: antes contaba todo lo
  // posterior y esas ventas aparecían repetidas en dos turnos.
  const ordenadas = [...cajas].sort((a, b) => Date.parse(a.abierta_at) - Date.parse(b.abierta_at));
  const siguiente = new Map(ordenadas.map((c, i) => [c.id, ordenadas[i + 1]?.abierta_at ?? null]));

  return cajas.map((c) => {
    const inicio = Date.parse(c.abierta_at);
    const proxima = siguiente.get(c.id);
    const fin = c.cerrada_at
      ? Date.parse(c.cerrada_at)
      : proxima
        ? Date.parse(proxima) - 1
        : Number.POSITIVE_INFINITY;
    const dentro = (fecha: string) => {
      const t = Date.parse(fecha);
      return t >= inicio && t <= fin;
    };
    const actual = calcularCuadre({
      ventas: ventas.filter((v) => dentro(v.fecha)),
      devoluciones: devoluciones.filter((d) => dentro(d.fecha)),
      abonos: abonos.filter((a) => dentro(a.fecha)),
      gastos: gastos.filter((g) => dentro(g.fecha)),
    });

    const foto = fotoPorCaja.get(c.id);
    if (!foto) return armarSesion(c, actual);

    // Turno cerrado con foto: se muestra lo que se cuadró al cerrar.
    const guardado = foto.cuadre as CuadreTurno;
    const sesion = armarSesion(c, guardado);
    sesion.efectivo_esperado = Number(foto.efectivo_esperado);
    sesion.diferencia = Number(foto.diferencia);
    sesion.cierre_guardado = true;
    const dv = centavos(actual.ventaNeta - guardado.ventaNeta);
    const de = centavos(actual.efectivoNeto - guardado.efectivoNeto);
    sesion.cambios_posteriores = dv !== 0 || de !== 0 ? { ventas: dv, efectivo: de } : null;
    return sesion;
  });
}
