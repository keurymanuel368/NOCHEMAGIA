export type ResumenPorMetodo = { efectivo: number; tarjeta: number; transferencia: number; fiado: number };

export type ResumenContable = {
  ventasTotal: number;
  numVentas: number;
  porMetodo: ResumenPorMetodo;
  abonosCobrados: number;
  /** Devoluciones del período (todas) y las que se pagaron en efectivo. */
  devolucionesTotal: number;
  devolucionesEfectivo: number;
  gastosTotal: number;
  ingresosReales: number;
  utilidad: number;
  ventasPorDia: { fecha: string; total: number }[];
  topProductos: { nombre: string; cantidad: number; monto: number }[];
  gastosPorCategoria: { categoria: string; total: number }[];
};

export type Gasto = {
  id: string;
  descripcion: string;
  categoria_gasto: string;
  monto: number;
  metodo_pago: string;
  usuario_nombre: string;
  usuario_id: string | null;
  fecha: string;
  notas: string | null;
};

export const CATEGORIAS_GASTO = [
  "Inventario",
  "Servicios",
  "Alquiler",
  "Salarios",
  "Transporte",
  "Mantenimiento",
  "General",
] as const;
