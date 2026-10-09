"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { traerTodas } from "@/lib/supabase/paginar";
import { formatMoney } from "@/lib/money";
import { hoyRD, rangoDiasRD } from "@/lib/fecha-rd";
import { VentaDetalleModal } from "./VentaDetalleModal";
import { ETIQUETA_DESGLOSE, ORDEN_DESGLOSE, sumarDesglose, textoMetodoPago, type PagoFila } from "@/lib/pagos";

type HistorialItem = {
  id: string;
  numero_factura: string;
  total: number;
  metodo_pago: string;
  venta_pagos: PagoFila[] | null;
  estado: string;
  fecha: string;
  cliente_nombre: string;
  cajero_nombre: string;
};

const METODO_EMOJI: Record<string, string> = {
  efectivo: "💵",
  tarjeta: "💳",
  transferencia: "🔁",
  fiado: "📒",
  mixto: "🔀",
};

function hoyISO() {
  return hoyRD();
}

export function HistorialTab() {
  const [fecha, setFecha] = useState(hoyISO());
  const [ventas, setVentas] = useState<HistorialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [ventaSeleccionada, setVentaSeleccionada] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    const supabase = createClient();

    (async () => {
      const { desdeISO: desde, hastaISO: hasta } = rangoDiasRD(fecha, fecha);
      // Todas las ventas del día, aunque pasen de 1000.
      const consultar = (conPagos: boolean) =>
        traerTodas((a, b) =>
          supabase
            .from("ventas")
            .select(
              `id, numero_factura, total, metodo_pago, estado, fecha, clientes(nombre), usuarios(nombre)${
                conPagos ? ", venta_pagos(metodo, tipo_tarjeta, monto)" : ""
              }`
            )
            .gte("fecha", desde)
            .lt("fecha", hasta)
            .order("fecha", { ascending: false })
            .order("id", { ascending: false })
            .range(a, b)
        );
      // Sin el SQL de pagos mixtos la tabla venta_pagos no existe: se
      // consulta sin el desglose.
      let res = await consultar(true);
      if (res.error) res = await consultar(false);
      const data = res.data as unknown as
        | {
            id: string;
            numero_factura: string;
            total: number;
            metodo_pago: string;
            estado: string;
            fecha: string;
            clientes: unknown;
            usuarios: unknown;
            venta_pagos?: PagoFila[] | null;
          }[]
        | null;

      if (cancelado) return;
      setVentas(
        (data ?? []).map((v) => ({
          id: v.id,
          numero_factura: v.numero_factura,
          total: Number(v.total),
          metodo_pago: v.metodo_pago,
          venta_pagos: v.venta_pagos ?? null,
          estado: v.estado,
          fecha: v.fecha,
          cliente_nombre:
            (v.clientes as unknown as { nombre: string } | null)?.nombre ?? "General",
          cajero_nombre:
            (v.usuarios as unknown as { nombre: string } | null)?.nombre ?? "—",
        }))
      );
      setLoading(false);
    })();

    return () => {
      cancelado = true;
    };
  }, [fecha, recarga]);

  // Mismo criterio que "Ventas de hoy" y el cierre de caja: solo ventas
  // completadas (las anuladas o devueltas se listan pero no suman).
  // Las ventas mixtas se reparten entre efectivo, tarjeta y transferencia.
  const resumen = useMemo(() => {
    const completadas = ventas.filter((v) => v.estado === "completada");
    const total = completadas.reduce((s, v) => s + v.total, 0);
    const desglose = sumarDesglose(completadas);
    const porMetodo = ORDEN_DESGLOSE.filter((k) => desglose[k] !== 0).map((k) => ({
      etiqueta: ETIQUETA_DESGLOSE[k],
      monto: desglose[k],
    }));
    return { total, porMetodo };
  }, [ventas]);

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="rounded-xl border border-vt-border bg-vt-card px-3 py-2 font-mono text-sm text-neutral-900 outline-none focus:border-vt-blue dark:text-white"
        />
        {!loading && ventas.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-vt-text2">
            <span className="font-semibold text-neutral-900 dark:text-white">
              Total del día: {formatMoney(resumen.total)}
            </span>
            {resumen.porMetodo.map(({ etiqueta, monto }) => (
              <span key={etiqueta}>
                {etiqueta}: {formatMoney(monto)}
              </span>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-vt-text3">Cargando…</div>
      ) : ventas.length === 0 ? (
        <div className="py-10 text-center text-sm text-vt-text3">
          No hay ventas registradas este día
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {ventas.map((v) => (
            <button
              key={v.id}
              onClick={() => setVentaSeleccionada(v.id)}
              className="flex items-center justify-between rounded-xl border border-vt-border bg-[#F8FAFF] px-4 py-3 text-left transition hover:translate-x-0.5 hover:border-vt-blue hover:bg-vt-card-hover dark:bg-white/[0.02]"
            >
              <div>
                <div className="font-mono text-xs font-bold text-vt-blue">
                  {v.numero_factura}
                </div>
                <div className="text-sm font-bold text-neutral-900 dark:text-white">
                  {v.cliente_nombre}
                </div>
                <div className="mt-0.5 text-[11px] text-vt-text2">
                  {new Date(v.fecha).toLocaleTimeString("es-DO", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}{" "}
                  · {METODO_EMOJI[v.metodo_pago] ?? ""} {textoMetodoPago(v.metodo_pago, v.venta_pagos)} ·{" "}
                  {v.cajero_nombre}
                  {v.estado !== "completada" && (
                    <span className="ml-1 font-semibold capitalize text-vt-red">· {v.estado}</span>
                  )}
                </div>
              </div>
              <div className="font-head text-[15px] font-extrabold text-vt-green">
                {formatMoney(v.total)}
              </div>
            </button>
          ))}
        </div>
      )}

      {ventaSeleccionada && (
        <VentaDetalleModal
          ventaId={ventaSeleccionada}
          onClose={() => setVentaSeleccionada(null)}
          onAnulada={() => setRecarga((n) => n + 1)}
        />
      )}
    </div>
  );
}
