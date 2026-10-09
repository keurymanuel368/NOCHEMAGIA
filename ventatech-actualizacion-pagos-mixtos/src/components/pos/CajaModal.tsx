"use client";

import { useState, useTransition } from "react";
import { Archive, X } from "lucide-react";
import { abrirCajaAction, cerrarCajaAction, type CierreGuardado } from "@/app/actions/pos-actions";
import { formatMoney } from "@/lib/money";
import { useToast } from "@/components/ui/ToastProvider";
import { imprimirCierreCaja } from "@/lib/pos/printCaja";
import { useNegocio } from "@/components/providers/NegocioProvider";
import { efectivoEsperado, seccionesCierre, type CuadreTurno } from "@/lib/caja/cuadre";

export function CajaModal({
  mode,
  cuadre,
  onClose,
  onDone,
}: {
  mode: "abrir" | "cerrar";
  cuadre?: {
    montoInicial: number;
    /** Ventas por método, abonos, devoluciones y gastos del turno. */
    cuadre: CuadreTurno;
    cajero: string;
    abiertaAt: string;
  };
  onClose: () => void;
  onDone: () => void;
}) {
  const { nombre: negocioNombre } = useNegocio();
  const [monto, setMonto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const esperado = cuadre ? efectivoEsperado(cuadre.montoInicial, cuadre.cuadre) : null;
  const secciones = cuadre ? seccionesCierre(cuadre.cuadre, cuadre.montoInicial) : [];
  const contado = Number(monto);
  const diferencia =
    esperado !== null && monto !== "" && !Number.isNaN(contado)
      ? Math.round((contado - esperado) * 100) / 100
      : null;

  function confirmar() {
    const valor = Number(monto);
    if (Number.isNaN(valor) || valor < 0) {
      setError("Ingresa un monto válido");
      return;
    }
    startTransition(async () => {
      const res: { error?: string; cierre?: CierreGuardado; avisoCierre?: string } =
        mode === "abrir" ? await abrirCajaAction(valor) : await cerrarCajaAction(valor);
      if (res.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success(mode === "abrir" ? "Caja abierta" : "Caja cerrada");

      if (mode === "cerrar" && cuadre) {
        // Se imprime el cuadre definitivo que calculó el servidor al cerrar
        // (incluye ventas hechas mientras esta ventana estaba abierta).
        const final = res.cierre;
        if (res.avisoCierre) toast.error(res.avisoCierre);
        if (final && final.diferencia !== Math.round((valor - (esperado ?? 0)) * 100) / 100) {
          toast.error(
            `Hubo movimientos mientras cerrabas: el efectivo esperado final es ${formatMoney(final.efectivoEsperado)}`
          );
        }
        // No se espera la impresión: el cajero no debe quedarse mirando.
        imprimirCierreCaja({
          negocioNombre,
          cajero: cuadre.cajero,
          abiertaAt: final?.abiertaAt ?? cuadre.abiertaAt,
          cerradaAt: final?.cerradaAt ?? new Date().toISOString(),
          montoInicial: final?.montoInicial ?? cuadre.montoInicial,
          cuadre: final?.cuadre ?? cuadre.cuadre,
          montoContado: valor,
        }).catch(() => {});
      }

      onDone();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[95vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-[#0f1b33]">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-blue-500" />
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
              {mode === "abrir" ? "Abrir caja" : "Cerrar caja"}
            </h2>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {cuadre && esperado !== null && (
          <div className="mb-4 flex flex-col gap-3">
            {secciones.map((seccion, i) => (
              <div
                key={seccion.titulo}
                className={`rounded-xl border p-3 text-sm ${
                  i === 0
                    ? "border-blue-200 bg-blue-50/60 dark:border-blue-500/30 dark:bg-blue-500/5"
                    : "border-neutral-200 bg-neutral-50 dark:border-white/10 dark:bg-[#0b1424]"
                }`}
              >
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  {seccion.titulo}
                </div>
                {seccion.lineas.map((l) => (
                  <div
                    key={l.texto}
                    className={`flex items-center justify-between gap-3 ${
                      l.fuerte
                        ? "mt-1 border-t border-neutral-200 pt-1 font-semibold text-neutral-900 dark:border-white/10 dark:text-white"
                        : "text-neutral-600 dark:text-neutral-400"
                    }`}
                  >
                    <span>{l.texto}</span>
                    <span className="font-mono">{formatMoney(l.monto)}</span>
                  </div>
                ))}
                {seccion.nota && (
                  <p className="mt-1 text-[11px] text-neutral-400">{seccion.nota}</p>
                )}
              </div>
            ))}
          </div>
        )}

        <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {mode === "abrir" ? "Monto inicial en caja" : "Efectivo contado en la gaveta"}
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">
            RD$
          </span>
          <input
            autoFocus
            type="number"
            min={0}
            step="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2.5 pl-12 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-[#0b1424] dark:text-white"
          />
        </div>

        {diferencia !== null && (
          <p
            className={`mt-2 text-sm font-semibold ${
              diferencia === 0
                ? "text-neutral-500 dark:text-neutral-400"
                : diferencia > 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
            }`}
          >
            {diferencia === 0
              ? "Cuadra exacto"
              : diferencia > 0
                ? `Sobrante de ${formatMoney(diferencia)}`
                : `Faltante de ${formatMoney(Math.abs(diferencia))}`}
          </p>
        )}

        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          onClick={confirmar}
          disabled={pending}
          className="mt-4 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Guardando…" : mode === "abrir" ? "Abrir caja" : "Cerrar caja"}
        </button>
      </div>
    </div>
  );
}
