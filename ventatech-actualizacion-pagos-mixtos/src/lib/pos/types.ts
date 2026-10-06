export type Producto = {
  id: string;
  nombre: string;
  categoria: string | null;
  precio: number;
  precioMayoreo: number | null;
  cantidadMayoreo: number | null;
  stock: number;
  stock_minimo: number;
  codigo_barras: string | null;
  unidad: string;
};

// Solo "unidad" se vende en piezas enteras (1, 2, 3...). Cualquier otra
// unidad (libra, kg, litro, onza, etc.) se vende por peso/volumen y admite
// cantidades fraccionarias, cobrando proporcional al precio de esa unidad.
export function esUnidadEntera(unidad: string): boolean {
  return unidad.trim().toLowerCase() === "unidad";
}

export type Cliente = {
  id: string;
  nombre: string;
  telefono: string | null;
  saldo_deuda: number;
};

export type CartLine = {
  key: string;
  producto_id: string | null;
  nombre: string;
  precio: number;
  precioNormal: number;
  precioMayoreo: number | null;
  cantidadMayoreo: number | null;
  cantidad: number;
  unidad: string;
  stockDisponible: number | null;
};

// Si el producto tiene precio por mayor configurado y la cantidad en el
// carrito alcanza el mínimo, se cobra ese precio en vez del normal.
export function precioEfectivo(
  precioNormal: number,
  precioMayoreo: number | null,
  cantidadMayoreo: number | null,
  cantidad: number
): number {
  if (precioMayoreo !== null && cantidadMayoreo !== null && cantidad >= cantidadMayoreo) {
    return precioMayoreo;
  }
  return precioNormal;
}

// "mixto": parte en efectivo, parte en tarjeta y/o transferencia. Las partes
// se guardan en la tabla `venta_pagos` (ver src/lib/pagos.ts).
export type MetodoPago = "efectivo" | "tarjeta" | "transferencia" | "fiado" | "mixto";
