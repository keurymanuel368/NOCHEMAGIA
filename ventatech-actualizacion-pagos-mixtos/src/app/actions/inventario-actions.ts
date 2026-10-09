"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUsuarioActual } from "@/lib/get-usuario-actual";

export type InvActionState = {
  error?: string;
  success?: string;
  id?: string;
  // true cuando el producto ya existía (lo registró otra computadora, por
  // ejemplo). El formulario lo usa para refrescar la lista y el sincronizador
  // offline para descartar el pendiente en vez de reintentarlo para siempre.
  duplicado?: boolean;
};

function toNum(v: FormDataEntryValue | null): number | null {
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

// "" y espacios se guardan como NULL: varios productos SIN código de barras
// no deben chocar con la restricción única (empresa + código de barras).
function limpiarCodigo(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

function esErrorDuplicado(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "23505" || /duplicate key|unique constraint/i.test(error.message ?? "");
}

type Supa = Awaited<ReturnType<typeof createClient>>;
type ProductoEncontrado = { id: string; nombre: string; activo: boolean };

async function buscarPorCodigo(supabase: Supa, codigo: string): Promise<ProductoEncontrado[]> {
  const { data } = await supabase
    .from("productos")
    .select("id, nombre, activo")
    .eq("codigo_barras", codigo)
    .limit(10);
  return (data ?? []) as ProductoEncontrado[];
}

// Respaldo por si las políticas de seguridad no dejan ver productos
// eliminados: se busca con la llave de servicio, siempre filtrando por la
// empresa del usuario actual.
async function buscarPorCodigoAdmin(codigo: string): Promise<ProductoEncontrado[]> {
  try {
    const usuario = await getUsuarioActual();
    if (!usuario?.empresa_id) return [];
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("productos")
      .select("id, nombre, activo")
      .eq("empresa_id", usuario.empresa_id)
      .eq("codigo_barras", codigo)
      .limit(10);
    if (error) return [];
    return (data ?? []) as ProductoEncontrado[];
  } catch {
    return [];
  }
}

// Un producto ELIMINADO (activo = false) sigue ocupando su código de barras
// en la base de datos. Se le quita el código para que se pueda volver a usar.
// Solo toca productos inactivos y cuyo id salió de una búsqueda de la empresa.
async function liberarCodigoDeEliminado(supabase: Supa, id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("productos")
    .update({ codigo_barras: null })
    .eq("id", id)
    .eq("activo", false)
    .select("id");
  if (!error && data && data.length > 0) return true;

  try {
    const admin = createAdminClient();
    const r = await admin
      .from("productos")
      .update({ codigo_barras: null })
      .eq("id", id)
      .eq("activo", false)
      .select("id");
    return !r.error && (r.data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

function escaparLike(texto: string): string {
  return texto.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

type DatosGuardar = {
  id: string | null;
  nombre: string;
  codigo_barras: string | null;
  categoria_id: string | null;
  proveedor_id: string | null;
  descripcion: string;
  precio_compra: number;
  precio_venta: number | null;
  precio_mayoreo: number | null;
  cantidad_mayoreo: number | null;
  stock: number;
  stock_minimo: number;
  unidad: string;
  aplica_itbis: boolean;
  motivo_precio: string;
};

// Lógica central para crear/editar productos. Pensada para varias
// computadoras trabajando al mismo tiempo sobre el mismo inventario:
// 1) antes de guardar revisa en la BD (no en la lista de pantalla, que puede
//    estar vieja) si el código de barras ya existe;
// 2) si lo tiene un producto eliminado, lo libera;
// 3) si aun así la BD rechaza por duplicado (dos PCs guardando en el mismo
//    segundo), devuelve un mensaje claro en vez del error técnico.
async function guardarProductoSeguro(d: DatosGuardar): Promise<InvActionState> {
  const supabase = await createClient();
  const nombre = d.nombre.trim();
  const codigo = limpiarCodigo(d.codigo_barras);

  if (!nombre) return { error: "El nombre del producto es obligatorio" };

  if (codigo) {
    const encontrados = (await buscarPorCodigo(supabase, codigo)).filter((p) => p.id !== d.id);
    const activo = encontrados.find((p) => p.activo);
    if (activo) {
      revalidatePath("/inventario");
      return {
        error: `El código ${codigo} ya pertenece a "${activo.nombre}". Ese producto ya está registrado (puede que lo haya agregado otra computadora).`,
        duplicado: true,
        id: activo.id,
      };
    }
    for (const p of encontrados) await liberarCodigoDeEliminado(supabase, p.id);
  }

  // Evita el mismo producto (mismo nombre exacto) creado desde dos PCs.
  if (!d.id && !nombre.includes("*")) {
    const { data: mismoNombre } = await supabase
      .from("productos")
      .select("id, nombre")
      .eq("activo", true)
      .ilike("nombre", escaparLike(nombre))
      .limit(1);
    if (mismoNombre && mismoNombre.length > 0) {
      revalidatePath("/inventario");
      return {
        error: `Ya existe un producto llamado "${mismoNombre[0].nombre}". Puede que lo haya agregado otra computadora; si es distinto, cámbiale el nombre.`,
        duplicado: true,
        id: mismoNombre[0].id,
      };
    }
  }

  const params = {
    p_id: d.id,
    p_nombre: nombre,
    p_codigo_barras: codigo,
    p_categoria_id: d.categoria_id,
    p_proveedor_id: d.proveedor_id,
    p_descripcion: d.descripcion,
    p_precio_compra: d.precio_compra,
    p_precio_venta: d.precio_venta,
    p_precio_mayoreo: d.precio_mayoreo,
    p_cantidad_mayoreo: d.cantidad_mayoreo,
    p_stock: d.stock,
    p_stock_minimo: d.stock_minimo,
    p_unidad: d.unidad,
    p_aplica_itbis: d.aplica_itbis,
    p_activo: true,
    p_motivo_precio: d.motivo_precio,
  };

  let { data, error } = await supabase.rpc("guardar_producto", params);

  // Puede que un producto eliminado que no se ve con los permisos normales
  // tenga el código: se busca con permisos de servicio, se libera y se
  // reintenta una sola vez.
  if (error && esErrorDuplicado(error) && codigo) {
    const ocultos = (await buscarPorCodigoAdmin(codigo)).filter((p) => p.id !== d.id);
    const activoOculto = ocultos.find((p) => p.activo);
    if (!activoOculto) {
      let liberado = false;
      for (const p of ocultos) {
        if (await liberarCodigoDeEliminado(supabase, p.id)) liberado = true;
      }
      if (liberado) ({ data, error } = await supabase.rpc("guardar_producto", params));
    }
  }

  if (error) {
    revalidatePath("/inventario");
    if (esErrorDuplicado(error)) {
      return {
        error: codigo
          ? `El código ${codigo} ya está registrado. Otra computadora lo acaba de agregar; la lista se actualizó.`
          : "Este producto ya fue registrado desde otra computadora; la lista se actualizó.",
        duplicado: true,
      };
    }
    return { error: error.message };
  }

  revalidatePath("/inventario");
  revalidatePath("/pos");
  return { success: "Producto guardado", id: data as string };
}

export async function guardarProductoAction(
  _prev: InvActionState,
  formData: FormData
): Promise<InvActionState> {
  const id = formData.get("id");
  return guardarProductoSeguro({
    id: id ? String(id) : null,
    nombre: String(formData.get("nombre") ?? ""),
    codigo_barras: limpiarCodigo(formData.get("codigo_barras")),
    categoria_id: (formData.get("categoria_id") as string) || null,
    proveedor_id: (formData.get("proveedor_id") as string) || null,
    descripcion: String(formData.get("descripcion") ?? ""),
    precio_compra: toNum(formData.get("precio_compra")) ?? 0,
    precio_venta: toNum(formData.get("precio_venta")),
    precio_mayoreo: toNum(formData.get("precio_mayoreo")),
    cantidad_mayoreo: toNum(formData.get("cantidad_mayoreo")),
    stock: toNum(formData.get("stock")) ?? 0,
    stock_minimo: toNum(formData.get("stock_minimo")) ?? 0,
    unidad: String(formData.get("unidad") ?? "unidad"),
    aplica_itbis: formData.get("aplica_itbis") === "on",
    motivo_precio: String(formData.get("motivo_precio") ?? ""),
  });
}

export type NuevoProductoInput = {
  nombre: string;
  codigo_barras: string;
  categoria_id: string | null;
  proveedor_id: string | null;
  descripcion: string;
  precio_compra: number;
  precio_venta: number;
  precio_mayoreo: number | null;
  cantidad_mayoreo: number | null;
  stock: number;
  stock_minimo: number;
  unidad: string;
  aplica_itbis: boolean;
};

// Igual a guardarProductoAction pero recibiendo un objeto tipado en vez de
// FormData: lo usa el sincronizador para reenviar productos creados offline,
// donde ya no hay un <form> real del que leer.
export async function guardarProductoDatosAction(
  datos: NuevoProductoInput
): Promise<InvActionState> {
  return guardarProductoSeguro({
    id: null,
    nombre: datos.nombre,
    codigo_barras: limpiarCodigo(datos.codigo_barras),
    categoria_id: datos.categoria_id,
    proveedor_id: datos.proveedor_id,
    descripcion: datos.descripcion,
    precio_compra: datos.precio_compra,
    precio_venta: datos.precio_venta,
    precio_mayoreo: datos.precio_mayoreo,
    cantidad_mayoreo: datos.cantidad_mayoreo,
    stock: datos.stock,
    stock_minimo: datos.stock_minimo,
    unidad: datos.unidad,
    aplica_itbis: datos.aplica_itbis,
    motivo_precio: "",
  });
}

// Revisión rápida mientras el usuario escribe/escanea el código en el
// formulario: avisa ANTES de guardar si otra PC ya registró ese código.
export async function verificarCodigoBarrasAction(
  codigo: string,
  excluirId: string | null
): Promise<{ existe: boolean; nombre?: string }> {
  const limpio = limpiarCodigo(codigo);
  if (!limpio) return { existe: false };
  const supabase = await createClient();
  const activo = (await buscarPorCodigo(supabase, limpio)).find(
    (p) => p.activo && p.id !== excluirId
  );
  return activo ? { existe: true, nombre: activo.nombre } : { existe: false };
}

export async function ajustarStockAction(input: {
  productoId: string;
  tipo: "entrada" | "salida" | "ajuste";
  cantidad: number;
  motivo?: string;
}): Promise<InvActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("ajustar_stock", {
    p_producto_id: input.productoId,
    p_tipo: input.tipo,
    p_cantidad: input.cantidad,
    p_motivo: input.motivo ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/inventario");
  return { success: "Stock ajustado" };
}

export async function eliminarProductoAction(id: string): Promise<InvActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("eliminar_producto", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath("/inventario");
  return { success: "Producto eliminado" };
}

export async function guardarCategoriaAction(input: {
  id: string | null;
  nombre: string;
  descripcion?: string;
}): Promise<InvActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("guardar_categoria", {
    p_id: input.id,
    p_nombre: input.nombre,
    p_descripcion: input.descripcion ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/inventario");
  return { success: "Categoría guardada" };
}

export async function eliminarCategoriaAction(id: string): Promise<InvActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("eliminar_categoria", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath("/inventario");
  return { success: "Categoría eliminada" };
}

export async function guardarProveedorAction(
  _prev: InvActionState,
  formData: FormData
): Promise<InvActionState> {
  const supabase = await createClient();
  const id = formData.get("id");
  const { error } = await supabase.rpc("guardar_proveedor", {
    p_id: id ? String(id) : null,
    p_nombre: String(formData.get("nombre") ?? ""),
    p_telefono: String(formData.get("telefono") ?? ""),
    p_email: String(formData.get("email") ?? ""),
    p_direccion: String(formData.get("direccion") ?? ""),
    p_contacto: String(formData.get("contacto") ?? ""),
    p_rnc: String(formData.get("rnc") ?? ""),
  });
  if (error) return { error: error.message };
  revalidatePath("/inventario");
  return { success: "Proveedor guardado" };
}

export async function eliminarProveedorAction(id: string): Promise<InvActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("eliminar_proveedor", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath("/inventario");
  return { success: "Proveedor eliminado" };
}

export type CompraItemInput = { producto_id: string; cantidad: number; precio_unitario: number };

export async function registrarCompraAction(input: {
  items: CompraItemInput[];
  proveedorId: string | null;
  notas: string;
}): Promise<InvActionState> {
  if (
    input.items.length === 0 ||
    input.items.some(
      (i) => !(Number(i.cantidad) > 0) || !(Number(i.precio_unitario) >= 0) || !Number.isFinite(Number(i.precio_unitario))
    )
  ) {
    return { error: "Cantidades y precios deben ser mayores que cero" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registrar_compra", {
    p_items: input.items,
    p_proveedor_id: input.proveedorId,
    p_notas: input.notas,
  });
  if (error) return { error: error.message };
  revalidatePath("/inventario");
  return { success: "Compra registrada", id: data as string };
}

export async function anularCompraAction(id: string): Promise<InvActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("anular_compra", { p_compra_id: id });
  if (error) return { error: error.message };
  revalidatePath("/inventario");
  return { success: "Compra anulada" };
}
