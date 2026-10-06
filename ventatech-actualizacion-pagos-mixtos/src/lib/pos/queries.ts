import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Producto, Cliente } from "./types";
import { getCajaActual } from "@/lib/caja/queries";

export async function getProductosActivos(): Promise<Producto[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("productos")
    .select(
      "id, nombre, categoria, precio:precio_venta, precio_mayoreo, cantidad_mayoreo, stock, stock_minimo, codigo_barras, unidad"
    )
    .eq("activo", true)
    .order("nombre", { ascending: true });

  return (data ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    categoria: p.categoria,
    precio: Number(p.precio),
    precioMayoreo: p.precio_mayoreo === null ? null : Number(p.precio_mayoreo),
    cantidadMayoreo: p.cantidad_mayoreo === null ? null : Number(p.cantidad_mayoreo),
    stock: Number(p.stock),
    stock_minimo: Number(p.stock_minimo),
    codigo_barras: p.codigo_barras,
    unidad: p.unidad ?? "unidad",
  })) as Producto[];
}

export async function getClientesActivos(): Promise<Cliente[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clientes")
    .select("id, nombre, telefono, saldo_deuda")
    .eq("activo", true)
    .order("nombre", { ascending: true });
  return (data ?? []) as Cliente[];
}

// Misma cuenta que la pantalla de Caja (ventas por método, abonos,
// devoluciones y gastos del turno), para que el cierre desde el POS cuadre
// igual que desde Caja.
export async function getCajaAbierta() {
  return getCajaActual();
}
