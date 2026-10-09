"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Lock, Unlock, User, Clock, Wallet, Receipt, FileDown } from "lucide-react";
import type { CajaSesion } from "@/lib/caja/queries";
import { formatMoney } from "@/lib/money";
import { CajaModal } from "@/components/pos/CajaModal";
import { descargarReporteCaja } from "@/lib/caja/reportePdf";
import { useNegocio } from "@/components/providers/NegocioProvider";
import { seccionesCierre } from "@/lib/caja/cuadre";

function duracion(desde: string) {
  const ms = Date.now() - new Date(desde).getTime();
  const horas = Math.floor(ms / 3_600_000);
  const minutos = Math.floor((ms % 3_600_000) / 60_000);
  return `${horas}h ${minutos}m`;
}

export function CajaClient({
  cajaActual,
  historialInicial,
}: {
  cajaActual: CajaSesion | null;
  historialInicial: CajaSesion[];
}) {
  const router = useRouter();
  const { nombre: negocioNombre } = useNegocio();
  const [modal, setModal] = useState<"abrir" | "cerrar" | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <div
        className={`relative overflow-hidden rounded-2xl border p-6 transition-all ${
          cajaActual
            ? "border-vt-green/30 bg-gradient-to-br from-vt-green/10 to-transparent"
            : "border-vt-amber/30 bg-gradient-to-br from-vt-amber/10 to-transparent"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                cajaActual ? "bg-vt-green/15 text-vt-green" : "bg-vt-amber/15 text-vt-amber"
              }`}
            >
              {cajaActual ? <Unlock className="h-7 w-7" /> : <Lock className="h-7 w-7" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-head text-xl font-extrabold text-neutral-900 dark:text-white">
                  {cajaActual ? "Caja Abierta" : "Caja Cerrada"}
                </h2>
                {cajaActual && (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-vt-green opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-vt-green" />
                  </span>
                )}
              </div>
              {cajaActual ? (
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-vt-text2">
                  <span className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    {cajaActual.cajero_nombre}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Abierta hace {duracion(cajaActual.abierta_at)}
                  </span>
                </div>
              ) : (
                <p className="mt-1 text-sm text-vt-text3">No hay ninguna sesión de caja activa</p>
              )}
            </div>
          </div>

          <button
            onClick={() => setModal(cajaActual ? "cerrar" : "abrir")}
            className={`rounded-xl px-5 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 ${
              cajaActual ? "bg-vt-red hover:opacity-90" : "bg-vt-green hover:opacity-90"
            }`}
          >
            {cajaActual ? "Cerrar caja" : "Abrir caja"}
          </button>
        </div>

        {cajaActual && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-vt-border bg-vt-card p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-vt-text3">
                <Wallet className="h-3.5 w-3.5" />
                Monto inicial
              </div>
              <div className="mt-1 font-mono text-lg font-bold text-neutral-900 dark:text-white">
                {formatMoney(cajaActual.monto_inicial)}
              </div>
            </div>
            <div className="rounded-xl border border-vt-border bg-vt-card p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-vt-text3">
                <Receipt className="h-3.5 w-3.5" />
                Ventas en efectivo
              </div>
              <div className="mt-1 font-mono text-lg font-bold text-vt-green">
                {formatMoney(cajaActual.cuadre.desglose.efectivo)}
              </div>
            </div>
            <div className="rounded-xl border border-vt-border bg-vt-card p-3">
              <div className="text-[11px] text-vt-text3">Efectivo esperado en la gaveta</div>
              <div className="mt-1 font-mono text-lg font-bold text-vt-blue">
                {formatMoney(cajaActual.efectivo_esperado)}
              </div>
            </div>
            <div className="rounded-xl border border-vt-border bg-vt-card p-3">
              <div className="text-[11px] text-vt-text3">Venta del turno ({cajaActual.num_ventas})</div>
              <div className="mt-1 font-mono text-lg font-bold text-neutral-900 dark:text-white">
                {formatMoney(cajaActual.cuadre.ventaNeta)}
              </div>
            </div>
          </div>
        )}

        {cajaActual && (
          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
            {seccionesCierre(cajaActual.cuadre, cajaActual.monto_inicial).map((seccion) => (
              <div key={seccion.titulo} className="rounded-xl border border-vt-border bg-vt-card p-3 text-sm">
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-vt-text3">
                  {seccion.titulo}
                </div>
                {seccion.lineas.map((l) => (
                  <div
                    key={l.texto}
                    className={`flex items-center justify-between gap-3 ${
                      l.fuerte
                        ? "mt-1 border-t border-vt-border pt-1 font-semibold text-neutral-900 dark:text-white"
                        : "text-vt-text2"
                    }`}
                  >
                    <span>{l.texto}</span>
                    <span className="font-mono">{formatMoney(l.monto)}</span>
                  </div>
                ))}
                {seccion.nota && <p className="mt-1 text-[11px] text-vt-text3">{seccion.nota}</p>}
              </div>
            ))}
          </div>
        )}

        {cajaActual && (
          <p className="mt-2 text-[11px] text-vt-text3">
            Turno desde {new Date(cajaActual.abierta_at).toLocaleString("es-DO")}. En la gaveta solo debe
            estar el efectivo: tarjeta, transferencia y fiado no entran en el efectivo esperado.
          </p>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-neutral-900 dark:text-white">
            <Archive className="h-4 w-4 text-vt-blue" />
            Historial de caja
          </h3>
          <button
            onClick={() => descargarReporteCaja(historialInicial, cajaActual, negocioNombre)}
            className="flex items-center gap-1.5 rounded-xl border border-vt-border px-3.5 py-2 text-xs font-semibold text-vt-text2 transition hover:bg-vt-card-hover"
          >
            <FileDown className="h-3.5 w-3.5" />
            Descargar PDF
          </button>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-vt-border bg-vt-card">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-vt-border text-[11px] uppercase tracking-wide text-vt-text3">
                <th className="px-4 py-3 font-medium">Cajero</th>
                <th className="px-4 py-3 font-medium">Apertura</th>
                <th className="px-4 py-3 font-medium">Cierre</th>
                <th className="px-4 py-3 font-medium">Monto inicial</th>
                <th className="px-4 py-3 font-medium">Vendido</th>
                <th className="px-4 py-3 font-medium">Efectivo esperado</th>
                <th className="px-4 py-3 font-medium">Contado</th>
                <th className="px-4 py-3 font-medium">Diferencia</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {historialInicial.map((c) => {
                // Sobrante (+) o faltante (−): contado contra el efectivo
                // esperado del turno, no contra el monto inicial.
                const diferencia = c.diferencia;
                return (
                  <tr key={c.id} className="border-b border-vt-border last:border-0 hover:bg-vt-card-hover">
                    <td className="px-4 py-3 text-sm font-semibold text-neutral-900 dark:text-white">
                      {c.cajero_nombre}
                    </td>
                    <td className="px-4 py-3 text-xs text-vt-text2">
                      {new Date(c.abierta_at).toLocaleString("es-DO")}
                    </td>
                    <td className="px-4 py-3 text-xs text-vt-text2">
                      {c.cerrada_at ? new Date(c.cerrada_at).toLocaleString("es-DO") : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-vt-text2">
                      {formatMoney(c.monto_inicial)}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-vt-text2">
                      {formatMoney(c.cuadre.ventaNeta)}
                      {c.cambios_posteriores && (
                        <div
                          className="mt-0.5 font-sans text-[11px] font-semibold text-vt-amber"
                          title="Después de cerrar se anularon ventas, se borraron gastos o llegaron ventas sin conexión. El cuadre de arriba es el que se hizo al cerrar."
                        >
                          Cambió después del cierre: ventas {c.cambios_posteriores.ventas >= 0 ? "+" : "−"}
                          {formatMoney(Math.abs(c.cambios_posteriores.ventas))}, efectivo{" "}
                          {c.cambios_posteriores.efectivo >= 0 ? "+" : "−"}
                          {formatMoney(Math.abs(c.cambios_posteriores.efectivo))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-vt-text2">
                      {formatMoney(c.efectivo_esperado)}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-vt-text2">
                      {c.monto_final !== null ? formatMoney(c.monto_final) : "—"}
                    </td>
                    <td
                      className={`px-4 py-3 font-mono text-sm font-semibold ${
                        diferencia === null
                          ? "text-vt-text3"
                          : diferencia === 0
                            ? "text-vt-text2"
                            : diferencia > 0
                              ? "text-vt-green"
                              : "text-vt-red"
                      }`}
                    >
                      {diferencia === null
                        ? "—"
                        : diferencia === 0
                          ? "Exacto"
                          : `${diferencia > 0 ? "Sobra" : "Falta"} ${formatMoney(Math.abs(diferencia))}`}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          c.estado === "abierta"
                            ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400"
                            : "bg-neutral-200 text-neutral-600 dark:bg-white/10 dark:text-neutral-400"
                        }`}
                      >
                        {c.estado === "abierta" ? "Abierta" : "Cerrada"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {historialInicial.length === 0 && (
            <div className="py-10 text-center text-sm text-vt-text3">Sin historial de caja</div>
          )}
        </div>
      </div>

      {modal && (
        <CajaModal
          mode={modal}
          cuadre={
            modal === "cerrar" && cajaActual
              ? {
                  montoInicial: cajaActual.monto_inicial,
                  cuadre: cajaActual.cuadre,
                  cajero: cajaActual.cajero_nombre,
                  abiertaAt: cajaActual.abierta_at,
                }
              : undefined
          }
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
