import "server-only";
import { createClient } from "@/lib/supabase/server";
import { traerTodas } from "@/lib/supabase/paginar";
import type { Producto, Cliente } from "./types";
import { getCajaActual } from "@/lib/caja/queries";

export async function getProductosActivos(): Promise<Producto[]> {
  const supabase = await createClient();
  // Todos los productos activos (antes el POS solo cargaba los primeros 1000).
  const { data } = await traerTodas((a, b) =>
    supabase
      .from("productos")
      .select(
        "id, nombre, categoria, precio:precio_venta, precio_mayoreo, cantidad_mayoreo, stock, stock_minimo, codigo_barras, unidad"
      )
      .eq("activo", true)
      .order("nombre", { ascending: true })
      .order("id", { ascending: true })
      .range(a, b)
  );

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
  const { data } = await traerTodas((a, b) =>
    supabase
      .from("clientes")
      .select("id, nombre, telefono, saldo_deuda")
      .eq("activo", true)
      .order("nombre", { ascending: true })
      .order("id", { ascending: true })
      .range(a, b)
  );
  return (data ?? []) as Cliente[];
}

export type CajaAbiertaPOS = { id: string; monto_inicial: number; abierta_at: string } | null;

// Solo saber si hay caja abierta: el POS se recarga después de cada venta y
// calcular aquí el cuadre completo (ventas, abonos, devoluciones, gastos)
// lo hacía lento. El cuadre se pide al abrir la ventana de cierre.
export async function getCajaAbierta(): Promise<CajaAbiertaPOS> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("caja")
    .select("id, monto_inicial, abierta_at")
    .eq("estado", "abierta")
    .order("abierta_at", { ascending: false })
    .limit(1);
  const c = data?.[0];
  return c ? { id: c.id, monto_inicial: Number(c.monto_inicial), abierta_at: c.abierta_at } : null;
}

// Misma cuenta que la pantalla de Caja, para que el cierre desde el POS
// cuadre igual que desde Caja.
export async function getCuadreCajaAbierta() {
  return getCajaActual();
}
