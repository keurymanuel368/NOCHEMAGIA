"use client";

import { registrarVentaAction } from "@/app/actions/pos-actions";
import { listarVentasPendientes, eliminarVentaPendiente, marcarVentaPendienteError } from "./db";

let sincronizando = false;

export type ResultadoSync = {
  sincronizadas: number;
  conError: number;
  restantes: number;
};

/**
 * Reenvía las ventas hechas offline en el mismo orden en que se cobraron.
 * Nunca se ejecuta dos veces en paralelo ni se descarta una venta por un
 * error de red: si falla, se queda en la cola para el próximo intento.
 */
export async function sincronizarVentasPendientes(): Promise<ResultadoSync> {
  if (sincronizando) return { sincronizadas: 0, conError: 0, restantes: 0 };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { sincronizadas: 0, conError: 0, restantes: (await listarVentasPendientes()).length };
  }

  sincronizando = true;
  let sincronizadas = 0;
  let conError = 0;

  try {
    const pendientes = await listarVentasPendientes();
    // Se ordena por fecha para respetar el orden real de cobro.
    pendientes.sort((a, b) => a.fecha.localeCompare(b.fecha));

    for (const venta of pendientes) {
      try {
        const res = await registrarVentaAction({
          items: venta.items,
          clienteId: venta.clienteId,
          metodoPago: venta.metodoPago,
          tipoTarjeta: venta.tipoTarjeta ?? null,
          pagos: venta.pagos,
          descuento: venta.descuento,
          localId: venta.localId,
        });

        if (res.error) {
          conError += 1;
          await marcarVentaPendienteError(venta.localId, res.error);
          continue;
        }

        await eliminarVentaPendiente(venta.localId);
        sincronizadas += 1;
      } catch {
        // Se perdió la conexión a mitad de la sincronización: se detiene
        // y se reintenta todo en el próximo ciclo.
        break;
      }
    }
  } finally {
    sincronizando = false;
  }

  const restantes = (await listarVentasPendientes()).length;
  return { sincronizadas, conError, restantes };
}
