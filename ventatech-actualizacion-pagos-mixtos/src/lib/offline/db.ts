"use client";

import type { Producto, Cliente, MetodoPago } from "@/lib/pos/types";
import type { PagoParte, TipoTarjeta } from "@/lib/pagos";
import type { ProductoInventario, Categoria, Proveedor } from "@/lib/inventario/types";

const DB_NAME = "ventatech-offline";
const DB_VERSION = 2;

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

export type ProductoPendiente = {
  localId: string;
  fecha: string;
  datos: NuevoProductoInput;
  error?: string;
};

export type VentaPendienteItem = {
  producto_id: string | null;
  nombre?: string;
  precio?: number;
  cantidad: number;
};

export type VentaPendiente = {
  localId: string;
  fecha: string;
  items: VentaPendienteItem[];
  clienteId: string | null;
  clienteNombre: string;
  metodoPago: MetodoPago;
  /** Tarjeta: débito o crédito. */
  tipoTarjeta?: TipoTarjeta | null;
  /** Pago mixto: cuánto se pagó con cada método. */
  pagos?: PagoParte[];
  descuento: number;
  subtotal: number;
  total: number;
  montoRecibido?: number;
  cajeroNombre: string;
  error?: string;
};

function abrirDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("productos")) {
        db.createObjectStore("productos", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("clientes")) {
        db.createObjectStore("clientes", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("ventas_pendientes")) {
        db.createObjectStore("ventas_pendientes", { keyPath: "localId" });
      }
      if (!db.objectStoreNames.contains("inv_productos")) {
        db.createObjectStore("inv_productos", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("inv_categorias")) {
        db.createObjectStore("inv_categorias", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("inv_proveedores")) {
        db.createObjectStore("inv_proveedores", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("productos_pendientes")) {
        db.createObjectStore("productos_pendientes", { keyPath: "localId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function pedido<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function reemplazarTodo<T>(storeName: string, items: T[]): Promise<void> {
  const db = await abrirDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    store.clear();
    for (const item of items) store.put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function listarTodo<T>(storeName: string): Promise<T[]> {
  try {
    const db = await abrirDB();
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    return await pedido(store.getAll());
  } catch {
    return [];
  }
}

async function guardarUno<T>(storeName: string, item: T): Promise<void> {
  const db = await abrirDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function borrarUno(storeName: string, key: string): Promise<void> {
  const db = await abrirDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function guardarProductosCache(productos: Producto[]): Promise<void> {
  await reemplazarTodo("productos", productos);
}

export async function obtenerProductosCache(): Promise<Producto[]> {
  return listarTodo<Producto>("productos");
}

export async function ajustarStockCache(
  ajustes: { productoId: string; cantidad: number }[]
): Promise<void> {
  const productos = await obtenerProductosCache();
  const mapa = new Map(productos.map((p) => [p.id, p]));
  for (const { productoId, cantidad } of ajustes) {
    const p = mapa.get(productoId);
    if (p) mapa.set(productoId, { ...p, stock: Math.max(0, p.stock - cantidad) });
  }
  await guardarProductosCache(Array.from(mapa.values()));
}

export async function guardarClientesCache(clientes: Cliente[]): Promise<void> {
  await reemplazarTodo("clientes", clientes);
}

export async function obtenerClientesCache(): Promise<Cliente[]> {
  return listarTodo<Cliente>("clientes");
}

export async function encolarVentaPendiente(venta: VentaPendiente): Promise<void> {
  await guardarUno("ventas_pendientes", venta);
}

export async function listarVentasPendientes(): Promise<VentaPendiente[]> {
  return listarTodo<VentaPendiente>("ventas_pendientes");
}

export async function eliminarVentaPendiente(localId: string): Promise<void> {
  await borrarUno("ventas_pendientes", localId);
}

export async function marcarVentaPendienteError(localId: string, error: string): Promise<void> {
  const pendientes = await listarVentasPendientes();
  const venta = pendientes.find((v) => v.localId === localId);
  if (!venta) return;
  await guardarUno("ventas_pendientes", { ...venta, error });
}

export async function guardarProductosInventarioCache(
  productos: ProductoInventario[]
): Promise<void> {
  await reemplazarTodo("inv_productos", productos);
}

export async function obtenerProductosInventarioCache(): Promise<ProductoInventario[]> {
  return listarTodo<ProductoInventario>("inv_productos");
}

export async function guardarCategoriasCache(categorias: Categoria[]): Promise<void> {
  await reemplazarTodo("inv_categorias", categorias);
}

export async function obtenerCategoriasCache(): Promise<Categoria[]> {
  return listarTodo<Categoria>("inv_categorias");
}

export async function guardarProveedoresCache(proveedores: Proveedor[]): Promise<void> {
  await reemplazarTodo("inv_proveedores", proveedores);
}

export async function obtenerProveedoresCache(): Promise<Proveedor[]> {
  return listarTodo<Proveedor>("inv_proveedores");
}

export async function encolarProductoPendiente(producto: ProductoPendiente): Promise<void> {
  await guardarUno("productos_pendientes", producto);
}

export async function listarProductosPendientes(): Promise<ProductoPendiente[]> {
  return listarTodo<ProductoPendiente>("productos_pendientes");
}

export async function eliminarProductoPendiente(localId: string): Promise<void> {
  await borrarUno("productos_pendientes", localId);
}

export async function marcarProductoPendienteError(localId: string, error: string): Promise<void> {
  const pendientes = await listarProductosPendientes();
  const producto = pendientes.find((p) => p.localId === localId);
  if (!producto) return;
  await guardarUno("productos_pendientes", { ...producto, error });
}
