"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCuadreCajaAbierta } from "@/lib/pos/queries";
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

export async function cerrarCajaAction(montoFinal: number): Promise<PosActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cerrar_caja", { p_monto_final: montoFinal });
  if (error) return { error: error.message };
  revalidatePath("/pos");
  revalidatePath("/caja");
  revalidatePath("/");
  return { success: "Caja cerrada" };
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
    p_descuento: input.descuento,
    p_ncf_tipo: input.ncfTipo || null,
    p_cupon_id: input.cuponId || null,
    p_local_id: input.localId || null,
  });

  let ventaId = data as string;
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
