// Fechas "del día" en hora de República Dominicana.
//
// El servidor (Vercel) y la base de datos trabajan en UTC. Si "hoy" se
// calcula con `setHours(0, 0, 0, 0)` o `toISOString().slice(0, 10)`, el día
// empieza a las 8:00 p. m. de RD y las ventas de la noche caen en el día
// siguiente. Por eso "Ventas de hoy" no cuadraba con el cierre de caja, que
// cuenta desde la hora exacta en que se abrió la caja.
//
// RD está en UTC-4 todo el año (no usa horario de verano).

export const ZONA_NEGOCIO = "America/Santo_Domingo";
const OFFSET_NEGOCIO = "-04:00";

const OFFSET_MS = 4 * 60 * 60 * 1000;

/** Día (YYYY-MM-DD) en hora de RD de un instante. */
export function fechaRD(instante: Date | string): string {
  if (typeof instante === "string") {
    // Una columna `date` ya viene como YYYY-MM-DD: no se convierte.
    if (/^\d{4}-\d{2}-\d{2}$/.test(instante)) return instante;
    instante = new Date(instante);
  }
  // Se resta el desfase de RD y se lee la fecha en UTC: no depende del
  // formato de fecha del servidor (Intl puede devolver "10/6/2026").
  return new Date(instante.getTime() - OFFSET_MS).toISOString().slice(0, 10);
}

/** Hoy (YYYY-MM-DD) en hora de RD, sin importar la zona del servidor o del navegador. */
export function hoyRD(): string {
  return fechaRD(new Date());
}

/** Suma (o resta) días a una fecha YYYY-MM-DD. */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Primer día del mes (YYYY-MM-01) de una fecha YYYY-MM-DD. */
export function inicioMes(fecha: string): string {
  return `${fecha.slice(0, 8)}01`;
}

/** Primer día del mes anterior (YYYY-MM-01) de una fecha YYYY-MM-DD. */
export function inicioMesAnterior(fecha: string): string {
  return inicioMes(sumarDias(inicioMes(fecha), -1));
}

/** Instante (ISO, UTC) en que empieza ese día en RD. */
export function inicioDiaRD(fecha: string): string {
  return new Date(`${fecha}T00:00:00${OFFSET_NEGOCIO}`).toISOString();
}

/**
 * Rango para filtrar de `desde` a `hasta` (ambos incluidos) en hora de RD.
 * Úsalo con `.gte("fecha", desdeISO).lt("fecha", hastaISO)`: `hastaISO` es el
 * inicio del día siguiente, así no se pierden las ventas de las 11:59 p. m.
 */
export function rangoDiasRD(desde: string, hasta: string) {
  return { desdeISO: inicioDiaRD(desde), hastaISO: inicioDiaRD(sumarDias(hasta, 1)) };
}
