"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCuadreCajaAbierta } from "@/lib/pos/queries";
import { getUsuarioActual } from "@/lib/get-usuario-actual";
import { esModoSoporteSuperAdmin } from "@/lib/modo-soporte";
import { cuadreDelRango } from "@/lib/ventas/movimientos";
import { efectivoEsperado, type CuadreTurno } from "@/lib/caja/cuadre";
import type { MetodoPago, CartLine } from "@/lib/pos/types";
import { centavos, type PagoParte, type TipoTarjeta } from "@/lib/pagos";

export type PosActionState = { error?: string; success?: string };

/** Cuadre del turno abierto, para la ventana de cierre del POS. */
export async function obtenerCuadreCajaAction() {
  return getCuadreCajaAbierta();
}

export async function abrirCajaAction(montoInicial: number): Promise<PosActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("abrir_caja", { p_monto_inicial: montoInicial });
  if (error) return { error: error.message };
  revalidatePath("/pos");
  revalidatePath("/caja");
  revalidatePath("/");
  return { success: "Caja abierta" };
}

export type CierreGuardado = {
  abiertaAt: string;
  cerradaAt: string;
  montoInicial: number;
  montoContado: number;
  efectivoEsperado: number;
  diferencia: number;
  cuadre: CuadreTurno;
};

export async function cerrarCajaAction(
  montoFinal: number
): Promise<PosActionState & { cierre?: CierreGuardado; avisoCierre?: string }> {
  const supabase = await createClient();
  const { data: abiertas } = await supabase
    .from("caja")
    .select("id")
    .eq("estado", "abierta")
    .order("abierta_at", { ascending: false })
    .limit(1);
  const cajaId = abiertas?.[0]?.id as string | undefined;

  const { error } = await supabase.rpc("cerrar_caja", { p_monto_final: montoFinal });
  if (error) return { error: error.message };
  revalidatePath("/pos");
  revalidatePath("/caja");
  revalidatePath("/");

  // Cuadre definitivo, calculado con la hora exacta de cierre que guardó la
  // base de datos. Es lo que se imprime y lo que queda guardado: el
  // historial ya no lo recalcula (antes un turno cerrado cambiaba solo si
  // después se anulaba una venta o se borraba un gasto).
  if (!cajaId) return { success: "Caja cerrada" };
  const { data: caja } = await supabase
    .from("caja")
    .select("abierta_at, cerrada_at, monto_inicial, monto_final")
    .eq("id", cajaId)
    .maybeSingle();
  if (!caja?.cerrada_at) return { success: "Caja cerrada" };

  const cuadre = await cuadreDelRango(supabase, { desde: caja.abierta_at, hasta: caja.cerrada_at, hastaIncluido: true });
  const montoInicial = Number(caja.monto_inicial);
  const contado = caja.monto_final === null ? montoFinal : Number(caja.monto_final);
  const esperado = efectivoEsperado(montoInicial, cuadre);
  const cierre: CierreGuardado = {
    abiertaAt: caja.abierta_at,
    cerradaAt: caja.cerrada_at,
    montoInicial,
    montoContado: contado,
    efectivoEsperado: esperado,
    diferencia: centavos(contado - esperado),
    cuadre,
  };

  let avisoCierre: string | undefined;
  try {
    const { error: errorFoto } = await createAdminClient().from("caja_cierres").upsert({
      caja_id: cajaId,
      abierta_at: cierre.abiertaAt,
      cerrada_at: cierre.cerradaAt,
      monto_inicial: cierre.montoInicial,
      efectivo_esperado: cierre.efectivoEsperado,
      monto_contado: cierre.montoContado,
      diferencia: cierre.diferencia,
      cuadre: cierre.cuadre,
    });
    if (errorFoto) avisoCierre = "El cierre no se pudo guardar en el historial (falta ejecutar cierres-de-caja.sql).";
  } catch {
    avisoCierre = "El cierre no se pudo guardar en el historial.";
  }
  return { success: "Caja cerrada", cierre, avisoCierre };
}

export type ItemVentaInput = {
  producto_id: string | null;
  nombre?: string;
  precio?: number;
  cantidad: number;
};

const METODOS_PARTE = ["efectivo", "tarjeta", "transferencia"] as const;

/** Valida las partes de un pago mixto antes de registrar la venta. */
function validarPartes(pagos: PagoParte[] | undefined): string | null {
  if (!pagos || pagos.length < 2) return "Un pago mixto necesita al menos dos métodos";
  for (const p of pagos) {
    if (!METODOS_PARTE.includes(p.metodo)) return "Método no permitido en un pago mixto";
    if (!(Number(p.monto) > 0)) return "Cada parte del pago debe ser mayor que cero";
    if (p.metodo === "tarjeta" && p.tipoTarjeta !== "debito" && p.tipoTarjeta !== "credito") {
      return "Indica si la tarjeta es de débito o de crédito";
    }
  }
  return null;
}

/**
 * Ajusta las partes al total que confirmó el servidor (puede variar unos
 * pesos si un precio cambió justo antes de cobrar). La diferencia se carga
 * al efectivo, que es lo que el cajero cobra o devuelve en el momento.
 */
function ajustarPartes(pagos: PagoParte[], total: number): PagoParte[] {
  const partes = pagos.map((p) => ({ ...p, monto: centavos(Number(p.monto)) }));
  const diferencia = centavos(total - partes.reduce((s, p) => s + p.monto, 0));
  if (diferencia === 0) return partes;

  // La parte más grande es la que se usó como método al registrar la venta.
  const mayor = partes.reduce((m, p, i) => (p.monto > partes[m].monto ? i : m), 0);
  let idx = partes.findIndex((p) => p.metodo === "efectivo");
  if (idx < 0) idx = mayor;
  const nuevoMonto = centavos(partes[idx].monto + diferencia);
  if (nuevoMonto <= 0) return [{ ...partes[mayor], monto: total }];
  partes[idx] = { ...partes[idx], monto: nuevoMonto };
  return partes;
}

/** Guarda cómo se pagó la venta (tarjeta débito/crédito o pago mixto). */
async function guardarPartes(ventaId: string, partes: PagoParte[]): Promise<string | null> {
  try {
    const admin = createAdminClient();
    // Borrar y volver a insertar: si una venta offline se reenvía, el
    // servidor devuelve la misma venta y las partes no se duplican.
    const { error: errorBorrar } = await admin.from("venta_pagos").delete().eq("venta_id", ventaId);
    if (errorBorrar) return errorBorrar.message;
    const { error: errorInsertar } = await admin.from("venta_pagos").insert(
      partes.map((p) => ({
        venta_id: ventaId,
        metodo: p.metodo,
        tipo_tarjeta: p.metodo === "tarjeta" ? p.tipoTarjeta ?? null : null,
        monto: p.monto,
      }))
    );
    if (errorInsertar) return errorInsertar.message;
    if (partes.length > 1) {
      const { error } = await admin.from("ventas").update({ metodo_pago: "mixto" }).eq("id", ventaId);
      if (error) return error.message;
    }
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Error guardando el desglose del pago";
  }
}

export async function registrarVentaAction(input: {
  items: ItemVentaInput[];
  clienteId: string | null;
  metodoPago: MetodoPago;
  descuento: number;
  ncfTipo?: string | null;
  cuponId?: string | null;
  localId?: string | null;
  /** Solo para tarjeta: débito o crédito. */
  tipoTarjeta?: TipoTarjeta | null;
  /** Solo para pago mixto: cuánto se pagó con cada método. */
  pagos?: PagoParte[];
  /** Venta hecha sin conexión: hora real en que se cobró. */
  fechaOriginal?: string | null;
}): Promise<
  PosActionState & {
    ventaId?: string;
    numeroFactura?: string;
    fecha?: string;
    ncf?: string | null;
    subtotal?: number;
    descuento?: number;
    total?: number;
    items?: { nombre: string; cantidad: number; subtotal: number }[];
    /** Partes del pago tal como quedaron guardadas (tarjeta o mixto). */
    pagos?: PagoParte[];
    /** La venta se guardó, pero no el desglose del pago. */
    avisoPagos?: string;
  }
> {
  // Validación de montos en el servidor (no solo en la pantalla).
  if (input.items.length === 0) return { error: "La venta no tiene productos" };
  if (input.items.some((i) => !(Number(i.cantidad) > 0) || (i.precio !== undefined && !(Number(i.precio) >= 0)))) {
    return { error: "Cantidades y precios de la venta deben ser mayores que cero" };
  }
  if (!(Number(input.descuento) >= 0)) return { error: "El descuento no puede ser negativo" };

  const esMixto = input.metodoPago === "mixto";
  if (esMixto) {
    const error = validarPartes(input.pagos);
    if (error) return { error };
  }
  // Una venta con tarjeta sin tipo (p. ej. una venta offline hecha antes de
  // esta versión) se acepta igual y se cuenta como "Tarjeta (sin tipo)".

  // La venta se registra con el método de la parte más grande (un método
  // que la base de datos ya conoce); después se marca como "mixto" y se
  // guardan las partes.
  const metodoRpc: MetodoPago = esMixto
    ? input.pagos!.reduce((m, p) => (Number(p.monto) > Number(m.monto) ? p : m)).metodo
    : input.metodoPago;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registrar_venta", {
    p_items: input.items,
    p_cliente_id: input.clienteId,
    p_metodo_pago: metodoRpc,
    p_descuento: Math.round(Number(input.descuento) * 100) / 100,
    p_ncf_tipo: input.ncfTipo || null,
    p_cupon_id: input.cuponId || null,
    p_local_id: input.localId || null,
  });

  let ventaId = data as string;
  let esNueva = !error;
  if (error) {
    // La misma venta llegó dos veces (reintento): la base de datos rechaza la
    // copia. Se devuelve la venta que ya existe en vez de dar error o cobrar
    // otra vez.
    const existente =
      error.code === "23505" && input.localId
        ? (await supabase.from("ventas").select("id").eq("local_id", input.localId).maybeSingle()).data
        : null;
    if (!existente) return { error: error.message };
    ventaId = existente.id as string;
    esNueva = false;
  }

  // Venta hecha sin conexión: la base de datos le pone la hora en que se
  // sincronizó. Si eso fue después de cerrar caja, la venta caía en el turno
  // siguiente (un turno salía con faltante y el otro con sobrante). Se le
  // devuelve la hora real en que se cobró.
  if (esNueva && input.fechaOriginal) {
    const original = Date.parse(input.fechaOriginal);
    const ahora = Date.now();
    if (!Number.isNaN(original) && original < ahora - 60_000 && original > ahora - 7 * 86_400_000) {
      try {
        await createAdminClient()
          .from("ventas")
          .update({ fecha: new Date(original).toISOString() })
          .eq("id", ventaId);
      } catch {
        // Si no se puede, la venta queda con la hora de sincronización.
      }
    }
  }

  const [{ data: venta }, { data: items }] = await Promise.all([
    supabase
      .from("ventas")
      .select("numero_factura, fecha, ncf, subtotal, descuento, total")
      .eq("id", ventaId)
      .single(),
    supabase
      .from("venta_items")
      .select("nombre_producto, cantidad, subtotal")
      .eq("venta_id", ventaId),
  ]);

  let pagos: PagoParte[] | undefined;
  let avisoPagos: string | undefined;
  if (venta && (esMixto || input.metodoPago === "tarjeta")) {
    const total = Number(venta.total);
    pagos = esMixto
      ? ajustarPartes(input.pagos!, total)
      : [{ metodo: "tarjeta", tipoTarjeta: input.tipoTarjeta ?? null, monto: total }];
    const errorPartes = await guardarPartes(ventaId, pagos);
    if (errorPartes) {
      avisoPagos = `La venta se guardó, pero no el desglose del pago (${errorPartes}). Revisa que se haya ejecutado el SQL de pagos mixtos.`;
    }
  }

  // No se revalida "/pos": eso hacía que la respuesta de CADA venta esperara
  // a recargar toda la pantalla del POS (todos los productos, la caja...).
  // Con internet lento la función se cortaba después de guardar la venta,
  // el POS creía que había fallado y la volvía a mandar: factura doble.
  // El POS refresca sus datos solo, en segundo plano, después de cobrar.
  revalidatePath("/");
  revalidatePath("/caja");
  return {
    success: "Venta registrada",
    ventaId,
    numeroFactura: venta?.numero_factura,
    fecha: venta?.fecha,
    ncf: venta?.ncf,
    subtotal: venta ? Number(venta.subtotal) : undefined,
    descuento: venta ? Number(venta.descuento) : undefined,
    total: venta ? Number(venta.total) : undefined,
    items: (items ?? []).map((i) => ({
      nombre: i.nombre_producto,
      cantidad: Number(i.cantidad),
      subtotal: Number(i.subtotal),
    })),
    pagos,
    avisoPagos,
  };
}

// ============================================================
// Ventas aparcadas: para cuando un cliente se va a buscar algo (dinero,
// un producto que olvidó) y llega otro mientras tanto — se guarda el
// carrito tal cual, sin perderlo, y se retoma después.
// ============================================================

export type VentaAparcada = {
  id: string;
  cajeroNombre: string;
  clienteId: string | null;
  clienteNombre: string | null;
  nota: string | null;
  items: CartLine[];
  descuento: number;
  subtotal: number;
  createdAt: string;
};

export async function aparcarVentaAction(input: {
  cajeroNombre: string;
  clienteId: string | null;
  clienteNombre: string | null;
  nota: string;
  items: CartLine[];
  descuento: number;
  subtotal: number;
}): Promise<PosActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("ventas_aparcadas").insert({
    usuario_id: (await supabase.auth.getUser()).data.user?.id,
    cajero_nombre: input.cajeroNombre,
    cliente_id: input.clienteId,
    cliente_nombre: input.clienteNombre,
    nota: input.nota || null,
    items: input.items,
    descuento: input.descuento,
    subtotal: input.subtotal,
  });
  if (error) return { error: error.message };
  revalidatePath("/pos");
  return { success: "Venta aparcada" };
}

export async function listarVentasAparcadasAction(): Promise<VentaAparcada[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ventas_aparcadas")
    .select("id, cajero_nombre, cliente_id, cliente_nombre, nota, items, descuento, subtotal, created_at")
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map((v) => ({
    id: v.id,
    cajeroNombre: v.cajero_nombre,
    clienteId: v.cliente_id,
    clienteNombre: v.cliente_nombre,
    nota: v.nota,
    items: v.items as CartLine[],
    descuento: Number(v.descuento),
    subtotal: Number(v.subtotal),
    createdAt: v.created_at,
  }));
}

export async function eliminarVentaAparcadaAction(id: string): Promise<PosActionState> {
  const supabase = await createClient();
  // .select() para saber si de verdad se borró una fila: si dos cajeros
  // retoman la misma venta aparcada casi al mismo tiempo, solo el primero
  // en borrarla debe poder cargarla.
  const { data, error } = await supabase.from("ventas_aparcadas").delete().eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Esta venta aparcada ya no existe (puede que otro cajero ya la haya tomado)" };
  }
  revalidatePath("/pos");
  return { success: "Venta aparcada eliminada" };
}

// ============================================================
// Anular factura (por ejemplo, una cobrada dos veces). La factura no se
// borra: queda "anulada", sale de caja, dashboard y reportes, los productos
// vuelven al inventario y queda registrado quién la anuló, cuándo y por qué.
// Pueden hacerlo el administrador del negocio y el super admin en modo soporte.
// ============================================================

export async function puedeAnularFacturasAction(): Promise<boolean> {
  const usuario = await getUsuarioActual();
  if (!usuario) return false;
  return usuario.es_admin || usuario.es_super_admin || (await esModoSoporteSuperAdmin(usuario.id));
}

export async function anularVentaAction(ventaId: string, motivo: string): Promise<PosActionState> {
  const usuario = await getUsuarioActual();
  if (!usuario) return { error: "Sesión no válida" };
  const modoSoporte = await esModoSoporteSuperAdmin(usuario.id);
  if (!usuario.es_admin && !usuario.es_super_admin && !modoSoporte) {
    return { error: "Solo el administrador puede anular facturas" };
  }
  const motivoLimpio = motivo.trim();
  if (motivoLimpio.length < 3) return { error: "Escribe el motivo de la anulación" };

  // La factura tiene que ser de este negocio: se busca con la sesión del
  // usuario (las reglas de seguridad solo le muestran las de su empresa).
  const supabase = await createClient();
  const { data: venta } = await supabase.from("ventas").select("id, estado").eq("id", ventaId).maybeSingle();
  if (!venta) return { error: "No se encontró la factura" };
  if (venta.estado !== "completada") return { error: `Esta factura ya está ${venta.estado}` };

  try {
    const admin = createAdminClient();
    const { error } = await admin.rpc("anular_venta", {
      p_venta_id: ventaId,
      p_motivo: motivoLimpio,
      p_usuario_id: usuario.id,
      p_usuario_nombre: modoSoporte ? `${usuario.nombre} (soporte VentaTech)` : usuario.nombre,
      p_modo_soporte: modoSoporte,
    });
    if (error) {
      return {
        error: error.message.includes("anular_venta")
          ? "Falta ejecutar el SQL anular-facturas.sql en Supabase"
          : error.message,
      };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo anular la factura" };
  }

  revalidatePath("/");
  revalidatePath("/caja");
  revalidatePath("/inventario");
  revalidatePath("/clientes");
  revalidatePath("/fiado");
  return { success: "Factura anulada" };
}
