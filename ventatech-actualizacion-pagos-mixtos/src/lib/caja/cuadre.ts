// Cuadre de un turno de caja: cuánto se vendió por cada método y cuánto
// efectivo debe haber en la gaveta. Sin nada del servidor: lo usan las
// consultas y también la ventana de cierre en el navegador.
import { centavos, desgloseVacio, sumarDesglose, type Desglose, type PagoFila } from "@/lib/pagos";

export type VentaMov = {
  total: number;
  metodo_pago: string;
  fecha: string;
  venta_pagos: PagoFila[] | null;
};

export type DevolucionMov = { total_devuelto: number; metodo_devolucion: string; fecha: string };
export type AbonoMov = { monto: number; metodo_pago: string; fecha: string };
export type GastoMov = { monto: number; metodo_pago: string; fecha: string; categoria_gasto: string };

export type CuadreTurno = {
  numVentas: number;
  /** Todo lo facturado (todos los métodos), antes de devoluciones. */
  ventasTotal: number;
  /** Ventas por método: efectivo, tarjeta débito/crédito, transferencia, fiado. */
  desglose: Desglose;
  devolucionesTotal: number;
  devolucionesEfectivo: number;
  /** Venta real del turno: facturado − devoluciones. */
  ventaNeta: number;
  /** Cobros de fiado (abonos) recibidos en el turno, por método. */
  abonosEfectivo: number;
  abonosTarjeta: number;
  abonosTransferencia: number;
  gastosEfectivo: number;
  /**
   * Efectivo que entró (o salió) de la gaveta en el turno, sin el monto
   * inicial: ventas en efectivo + abonos en efectivo − devoluciones en
   * efectivo − gastos pagados en efectivo.
   */
  efectivoNeto: number;
};

export function cuadreVacio(): CuadreTurno {
  return {
    numVentas: 0,
    ventasTotal: 0,
    desglose: desgloseVacio(),
    devolucionesTotal: 0,
    devolucionesEfectivo: 0,
    ventaNeta: 0,
    abonosEfectivo: 0,
    abonosTarjeta: 0,
    abonosTransferencia: 0,
    gastosEfectivo: 0,
    efectivoNeto: 0,
  };
}

export function calcularCuadre(datos: {
  ventas: VentaMov[];
  devoluciones: DevolucionMov[];
  abonos: AbonoMov[];
  gastos: GastoMov[];
}): CuadreTurno {
  const desglose = sumarDesglose(datos.ventas);
  const ventasTotal = centavos(datos.ventas.reduce((s, v) => s + v.total, 0));
  const devolucionesTotal = centavos(datos.devoluciones.reduce((s, d) => s + d.total_devuelto, 0));
  const devolucionesEfectivo = centavos(
    datos.devoluciones.filter((d) => d.metodo_devolucion === "efectivo").reduce((s, d) => s + d.total_devuelto, 0)
  );
  const sumaAbonos = (metodo: string) =>
    centavos(datos.abonos.filter((a) => a.metodo_pago === metodo).reduce((s, a) => s + a.monto, 0));
  const abonosEfectivo = sumaAbonos("efectivo");
  const gastosEfectivo = centavos(
    datos.gastos.filter((g) => g.metodo_pago === "efectivo").reduce((s, g) => s + g.monto, 0)
  );

  return {
    numVentas: datos.ventas.length,
    ventasTotal,
    desglose,
    devolucionesTotal,
    devolucionesEfectivo,
    ventaNeta: centavos(ventasTotal - devolucionesTotal),
    abonosEfectivo,
    abonosTarjeta: sumaAbonos("tarjeta"),
    abonosTransferencia: sumaAbonos("transferencia"),
    gastosEfectivo,
    efectivoNeto: centavos(desglose.efectivo + abonosEfectivo - devolucionesEfectivo - gastosEfectivo),
  };
}


// ============================================================
// Resumen de cierre: lo mismo en pantalla, en el ticket y en el PDF
// ============================================================

export type LineaCierre = { texto: string; monto: number; fuerte?: boolean };
export type SeccionCierre = { titulo: string; nota?: string; lineas: LineaCierre[] };

/** Efectivo que debe haber en la gaveta al cerrar. */
export function efectivoEsperado(montoInicial: number, cuadre: CuadreTurno): number {
  return centavos(montoInicial + cuadre.efectivoNeto);
}

export function seccionesCierre(cuadre: CuadreTurno, montoInicial: number): SeccionCierre[] {
  const d = cuadre.desglose;
  const siHay = (texto: string, monto: number): LineaCierre[] => (monto !== 0 ? [{ texto, monto }] : []);

  const gaveta: SeccionCierre = {
    titulo: "Efectivo en la gaveta (lo que debes contar)",
    lineas: [
      { texto: "Monto inicial", monto: montoInicial },
      { texto: "+ Ventas en efectivo", monto: d.efectivo },
      ...siHay("+ Abonos de fiado en efectivo", cuadre.abonosEfectivo),
      ...siHay("- Devoluciones en efectivo", cuadre.devolucionesEfectivo),
      ...siHay("- Gastos pagados en efectivo", cuadre.gastosEfectivo),
      { texto: "= Efectivo esperado", monto: efectivoEsperado(montoInicial, cuadre), fuerte: true },
    ],
  };

  const tarjetas = centavos(d.tarjeta_debito + d.tarjeta_credito + d.tarjeta);
  const ventas: SeccionCierre = {
    titulo: `Ventas del turno (${cuadre.numVentas})`,
    lineas: [
      { texto: "Efectivo", monto: d.efectivo },
      { texto: "Tarjeta débito", monto: d.tarjeta_debito },
      { texto: "Tarjeta crédito", monto: d.tarjeta_credito },
      ...siHay("Tarjeta (sin tipo)", d.tarjeta),
      { texto: "Transferencia", monto: d.transferencia },
      { texto: "Fiado (a crédito)", monto: d.fiado },
      { texto: "Total vendido", monto: cuadre.ventasTotal, fuerte: true },
      ...(cuadre.devolucionesTotal !== 0
        ? [
            { texto: "- Devoluciones", monto: cuadre.devolucionesTotal },
            { texto: "Venta neta", monto: cuadre.ventaNeta, fuerte: true },
          ]
        : []),
    ],
  };

  const banco: SeccionCierre = {
    titulo: "Para cuadrar con el banco / verifone",
    nota: "Esto no está en la gaveta.",
    lineas: [
      { texto: "Total tarjetas (ventas)", monto: tarjetas },
      ...siHay("Abonos de fiado con tarjeta", cuadre.abonosTarjeta),
      { texto: "Total transferencias (ventas)", monto: d.transferencia },
      ...siHay("Abonos de fiado por transferencia", cuadre.abonosTransferencia),
    ],
  };

  return [gaveta, ventas, banco];
}
