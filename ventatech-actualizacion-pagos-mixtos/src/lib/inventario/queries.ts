import "server-only";
import { createClient } from "@/lib/supabase/server";
import { traerTodas } from "@/lib/supabase/paginar";
import type {
  ProductoInventario,
  Categoria,
  Proveedor,
  InventarioStats,
  Compra,
} from "./types";

type ProductoRow = {
  id: string;
  codigo_barras: string | null;
  nombre: string;
  descripcion: string | null;
  categoria_id: string | null;
  proveedor_id: string | null;
  precio_compra: number;
  precio_venta: number;
  precio_mayoreo: number | null;
  cantidad_mayoreo: number | null;
  stock: number;
  stock_minimo: number;
  unidad: string;
  aplica_itbis: boolean;
  activo: boolean;
  created_at: string;
  categorias: { nombre: string } | null;
  proveedores: { nombre: string } | null;
};

function mapProducto(p: ProductoRow): ProductoInventario {
  return {
    id: p.id,
    codigo_barras: p.codigo_barras,
    nombre: p.nombre,
    descripcion: p.descripcion,
    categoria_id: p.categoria_id,
    categoria_nombre: p.categorias?.nombre ?? null,
    proveedor_id: p.proveedor_id,
    proveedor_nombre: p.proveedores?.nombre ?? null,
    precio_compra: Number(p.precio_compra),
    precio_venta: Number(p.precio_venta),
    precio_mayoreo: p.precio_mayoreo === null ? null : Number(p.precio_mayoreo),
    cantidad_mayoreo: p.cantidad_mayoreo === null ? null : Number(p.cantidad_mayoreo),
    stock: Number(p.stock),
    stock_minimo: Number(p.stock_minimo),
    unidad: p.unidad,
    aplica_itbis: p.aplica_itbis,
    activo: p.activo,
    created_at: p.created_at,
  };
}

const PRODUCTO_SELECT =
  "id, codigo_barras, nombre, descripcion, categoria_id, proveedor_id, precio_compra, precio_venta, precio_mayoreo, cantidad_mayoreo, stock, stock_minimo, unidad, aplica_itbis, activo, created_at, categorias(nombre), proveedores(nombre)";

export async function getProductosInventario(): Promise<ProductoInventario[]> {
  const supabase = await createClient();
  // Todos los productos activos, por páginas de 1000.
  const { data } = await traerTodas((a, b) =>
    supabase
      .from("productos")
      .select(PRODUCTO_SELECT)
      .eq("activo", true)
      .order("nombre", { ascending: true })
      .order("id", { ascending: true })
      .range(a, b)
  );
  return ((data ?? []) as unknown as ProductoRow[]).map(mapProducto);
}

export async function getInventarioStats(): Promise<InventarioStats> {
  const supabase = await createClient();
  const { data } = await traerTodas((a, b) =>
    supabase
      .from("productos")
      .select("precio_compra, stock, stock_minimo")
      .eq("activo", true)
      .order("id")
      .range(a, b)
  );

  const rows = data ?? [];
  const stock_bajo = rows.filter(
    (p) => Number(p.stock) > 0 && Number(p.stock) <= Number(p.stock_minimo)
  ).length;
  const sin_stock = rows.filter((p) => Number(p.stock) <= 0).length;
  // Un producto con existencia negativa (vendido de más) no resta valor al inventario.
  const valor_costo =
    Math.round(rows.reduce((s, p) => s + Number(p.precio_compra) * Math.max(0, Number(p.stock)), 0) * 100) / 100;

  return {
    total_productos: rows.length,
    valor_costo,
    stock_bajo,
    sin_stock,
  };
}

export async function getCategorias(): Promise<Categoria[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categorias")
    .select("id, nombre, descripcion, productos(count)")
    .eq("activo", true)
    .order("nombre", { ascending: true });

  return (data ?? []).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    descripcion: c.descripcion,
    total_productos: (c.productos as unknown as { count: number }[])[0]?.count ?? 0,
  }));
}

export async function getProveedores(): Promise<Proveedor[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("proveedores")
    .select("id, nombre, contacto, telefono, email, direccion, rnc")
    .eq("activo", true)
    .order("nombre", { ascending: true });
  return (data ?? []) as Proveedor[];
}

export async function getCompras(): Promise<Compra[]> {
  const supabase = await createClient();
  // Todas las compras (antes solo las últimas 50).
  const { data } = await traerTodas((a, b) =>
    supabase
      .from("compras")
      .select(
        "id, numero_orden, fecha, total, estado, notas, proveedores(nombre), usuarios(nombre), compras_detalle(count)"
      )
      .order("fecha", { ascending: false })
      .order("id", { ascending: false })
      .range(a, b)
  );

  return (data ?? []).map((c) => ({
    id: c.id,
    numero_orden: c.numero_orden,
    fecha: c.fecha,
    total: Number(c.total),
    estado: c.estado,
    notas: c.notas,
    proveedor_nombre: (c.proveedores as unknown as { nombre: string } | null)?.nombre ?? null,
    usuario_nombre: (c.usuarios as unknown as { nombre: string } | null)?.nombre ?? null,
    total_items: (c.compras_detalle as unknown as { count: number }[])[0]?.count ?? 0,
  }));
}
