// Desglose del pago de cada venta: cuánto entró en efectivo, en tarjeta
// (débito o crédito), en transferencia o a fiado.
//
// Las ventas con tarjeta o con pago mixto guardan sus partes en la tabla
// `venta_pagos`. Las ventas viejas (o las de un solo método sin partes
// guardadas) se cuentan completas en su `metodo_pago`, como antes.
//
// Este archivo no usa nada del servidor: lo usan también el POS y el
// historial en el navegador.

export type MetodoParte = "efectivo" | "tarjeta" | "transferencia";
export type TipoTarjeta = "debito" | "credito";

export type PagoParte = {
  metodo: MetodoParte;
  tipoTarjeta?: TipoTarjeta | null;
  monto: number;
};

/** Fila de `venta_pagos` tal como llega de Supabase. */
export type PagoFila = {
  metodo: string;
  tipo_tarjeta: string | null;
  monto: number | string;
};

/** Claves del desglose usadas en caja, dashboard y reportes. */
export type ClaveDesglose =
  | "efectivo"
  | "tarjeta_debito"
  | "tarjeta_credito"
  | "tarjeta"
  | "transferencia"
  | "fiado";

export type Desglose = Record<ClaveDesglose, number>;

export const ORDEN_DESGLOSE: ClaveDesglose[] = [
  "efectivo",
  "tarjeta_debito",
  "tarjeta_credito",
  "tarjeta",
  "transferencia",
  "fiado",
];

export const ETIQUETA_DESGLOSE: Record<ClaveDesglose, string> = {
  efectivo: "Efectivo",
  tarjeta_debito: "Tarjeta débito",
  tarjeta_credito: "Tarjeta crédito",
  tarjeta: "Tarjeta (sin tipo)",
  transferencia: "Transferencia",
  fiado: "Fiado (a crédito)",
};

export function desgloseVacio(): Desglose {
  return {
    efectivo: 0,
    tarjeta_debito: 0,
    tarjeta_credito: 0,
    tarjeta: 0,
    transferencia: 0,
    fiado: 0,
  };
}

/** Redondea a centavos para que las sumas no arrastren decimales sueltos. */
export function centavos(n: number): number {
  return Math.round(n * 100) / 100;
}

function claveDe(metodo: string, tipoTarjeta: string | null | undefined): ClaveDesglose | null {
  if (metodo === "efectivo") return "efectivo";
  if (metodo === "transferencia") return "transferencia";
  if (metodo === "fiado") return "fiado";
  if (metodo === "tarjeta") {
    if (tipoTarjeta === "debito") return "tarjeta_debito";
    if (tipoTarjeta === "credito") return "tarjeta_credito";
    return "tarjeta";
  }
  return null;
}

/**
 * Reparte el total de una venta entre los métodos con que se pagó.
 * Si la venta tiene partes guardadas se usan esas; si no, todo el total va
 * a su `metodo_pago`.
 */
export function desglosarVenta(venta: {
  total: number | string;
  metodo_pago: string;
  venta_pagos?: PagoFila[] | null;
}): Partial<Desglose> {
  const total = Number(venta.total);
  const partes = venta.venta_pagos ?? [];
  const resultado: Partial<Desglose> = {};

  if (partes.length > 0) {
    let asignado = 0;
    for (const p of partes) {
      const clave = claveDe(p.metodo, p.tipo_tarjeta);
      if (!clave) continue;
      const monto = Number(p.monto);
      resultado[clave] = (resultado[clave] ?? 0) + monto;
      asignado += monto;
    }
    // Las partes siempre suman el total de la venta; si por algo no fuera
    // así (venta editada a mano), la diferencia se deja en el método
    // principal para que el total vendido nunca cambie.
    const resto = centavos(total - asignado);
    if (resto !== 0) {
      const clave = claveDe(venta.metodo_pago, null) ?? "efectivo";
      resultado[clave] = (resultado[clave] ?? 0) + resto;
    }
    return resultado;
  }

  // "mixto" sin partes no debería existir; se cuenta como efectivo.
  const clave = claveDe(venta.metodo_pago, null) ?? "efectivo";
  resultado[clave] = total;
  return resultado;
}

/** Suma el desglose de muchas ventas. */
export function sumarDesglose(
  ventas: { total: number | string; metodo_pago: string; venta_pagos?: PagoFila[] | null }[]
): Desglose {
  const total = desgloseVacio();
  for (const v of ventas) {
    const d = desglosarVenta(v);
    for (const clave of ORDEN_DESGLOSE) total[clave] += d[clave] ?? 0;
  }
  for (const clave of ORDEN_DESGLOSE) total[clave] = centavos(total[clave]);
  return total;
}

/** Tarjeta de cualquier tipo (débito + crédito + sin tipo). */
export function totalTarjeta(d: Desglose): number {
  return centavos(d.tarjeta_debito + d.tarjeta_credito + d.tarjeta);
}

/** Texto corto del método de pago de una venta, para listas y tickets. */
export function textoMetodoPago(metodo: string, partes?: PagoFila[] | null): string {
  const lista = partes ?? [];
  if (lista.length === 0) {
    return metodo === "mixto" ? "Mixto" : metodo;
  }
  if (lista.length === 1 && metodo !== "mixto") {
    const clave = claveDe(lista[0].metodo, lista[0].tipo_tarjeta);
    return clave ? ETIQUETA_DESGLOSE[clave].replace(" (sin tipo)", "") : metodo;
  }
  return "Mixto";
}

/** Líneas "Tarjeta débito  RD$ 300.00" para tickets y el detalle de la venta. */
export function lineasPago(partes: (PagoParte | PagoFila)[]): { etiqueta: string; monto: number }[] {
  return partes.map((p) => {
    const tipo = "tipoTarjeta" in p ? p.tipoTarjeta : (p as PagoFila).tipo_tarjeta;
    const clave = claveDe(p.metodo, tipo) ?? "efectivo";
    return {
      etiqueta: ETIQUETA_DESGLOSE[clave].replace(" (sin tipo)", ""),
      monto: Number(p.monto),
    };
  });
}
