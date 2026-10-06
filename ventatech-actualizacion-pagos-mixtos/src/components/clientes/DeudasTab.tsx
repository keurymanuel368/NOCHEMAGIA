"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { traerTodas } from "@/lib/supabase/paginar";
import type { Deuda, FiadoResumen } from "@/lib/clientes/types";
import { formatMoney } from "@/lib/money";
import { AbonoModal } from "./AbonoModal";
import { BotonCopiaFactura } from "@/components/pos/BotonCopiaFactura";

const ESTADO_STYLES: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  parcial: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  pagada: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
};

export function DeudasTab({
  deudasIniciales,
  resumen,
  topDeudores,
}: {
  deudasIniciales: Deuda[];
  resumen: FiadoResumen;
  topDeudores: { nombre: string; saldo: number }[];
}) {
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState<"pendiente" | "pagada" | "todas">("pendiente");
  const [deudas, setDeudas] = useState(deudasIniciales);
  const [loading, setLoading] = useState(false);
  const [abonoDeuda, setAbonoDeuda] = useState<Deuda | null>(null);

  useEffect(() => {
    if (estado === "pendiente") {
      setDeudas(deudasIniciales);
      return;
    }
    let cancelado = false;
    setLoading(true);
    const supabase = createClient();
    (async () => {
      // Todas las deudas (antes solo las últimas 200).
      const { data } = await traerTodas((a, b) => {
        let query = supabase
          .from("deudas")
          .select(
            "id, cliente_id, venta_id, monto_original, monto_pagado, saldo, estado, fecha, clientes(nombre, cedula, telefono), ventas(numero_factura)"
          );
        if (estado === "pagada") query = query.eq("estado", "pagada");
        return query.order("fecha", { ascending: false }).order("id", { ascending: false }).range(a, b);
      });
      if (cancelado) return;
      setDeudas(
        (data ?? []).map((d) => ({
          id: d.id,
          cliente_id: d.cliente_id,
          cliente_nombre: (d.clientes as unknown as { nombre: string } | null)?.nombre ?? "—",
          cedula: (d.clientes as unknown as { cedula: string | null } | null)?.cedula ?? null,
          telefono: (d.clientes as unknown as { telefono: string | null } | null)?.telefono ?? null,
          venta_id: d.venta_id,
          numero_factura: (d.ventas as unknown as { numero_factura: string } | null)?.numero_factura ?? null,
          monto_original: Number(d.monto_original),
          monto_pagado: Number(d.monto_pagado),
          saldo: Number(d.saldo),
          estado: d.estado,
          fecha: d.fecha,
        }))
      );
      setLoading(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [estado, deudasIniciales]);

  const filtradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return deudas;
    return deudas.filter(
      (d) => d.cliente_nombre.toLowerCase().includes(q) || (d.cedula ?? "").includes(q)
    );
  }, [deudas, search]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vt-text3" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente con deuda…"
              className="w-full rounded-xl border border-vt-border bg-vt-bg py-2.5 pl-10 pr-3 text-sm outline-none focus:border-vt-blue"
            />
          </div>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value as typeof estado)}
            className="rounded-xl border border-vt-border bg-vt-card px-3 py-2.5 text-sm outline-none focus:border-vt-blue"
          >
            <option value="pendiente">Pendientes</option>
            <option value="pagada">Pagadas</option>
            <option value="todas">Todas</option>
          </select>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-vt-border bg-vt-card">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-vt-border text-[11px] uppercase tracking-wide text-vt-text3">
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Factura</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Original</th>
                <th className="px-4 py-3 font-medium">Pagado</th>
                <th className="px-4 py-3 font-medium">Saldo</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 text-center font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((d) => (
                <tr key={d.id} className="border-b border-vt-border last:border-0 hover:bg-vt-card-hover">
                  <td className="px-4 py-3">
                    <div className="text-sm font-semibold text-neutral-900 dark:text-white">{d.cliente_nombre}</div>
                    {d.telefono && <div className="text-[11px] text-vt-text3">{d.telefono}</div>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-vt-blue">{d.numero_factura ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-vt-text2">
                    {new Date(d.fecha).toLocaleDateString("es-DO")}
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-vt-text2">{formatMoney(d.monto_original)}</td>
                  <td className="px-4 py-3 font-mono text-sm text-vt-text2">{formatMoney(d.monto_pagado)}</td>
                  <td className="px-4 py-3 font-mono text-sm font-bold text-vt-red">{formatMoney(d.saldo)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${ESTADO_STYLES[d.estado]}`}>
                      {d.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1.5">
                      {d.venta_id && <BotonCopiaFactura ventaId={d.venta_id} />}
                      {d.estado !== "pagada" && (
                        <button
                          onClick={() => setAbonoDeuda(d)}
                          className="rounded-lg bg-vt-blue px-3 py-1 text-xs font-semibold text-white hover:opacity-90"
                        >
                          Abonar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && filtradas.length === 0 && (
            <div className="py-10 text-center text-sm text-vt-text3">No hay deudas que coincidan</div>
          )}
          {loading && <div className="py-10 text-center text-sm text-vt-text3">Cargando…</div>}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="rounded-2xl border border-vt-border bg-vt-card">
          <div className="flex items-center justify-between border-b border-vt-border px-4 py-3">
            <span className="flex items-center gap-1.5 font-head text-sm font-bold text-neutral-900 dark:text-white">
              <Trophy className="h-4 w-4 text-vt-amber" />
              Top Deudores
            </span>
          </div>
          {topDeudores.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-vt-text3">Sin deudas activas</div>
          ) : (
            <div className="flex flex-col divide-y divide-vt-border">
              {topDeudores.map((d, i) => (
                <div key={d.nombre + i} className="flex items-center justify-between px-4 py-2.5">
                  <span className="flex items-center gap-2 text-sm text-neutral-900 dark:text-white">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-vt-amber/15 text-[11px] font-bold text-vt-amber">
                      {i + 1}
                    </span>
                    {d.nombre}
                  </span>
                  <span className="font-mono text-sm font-bold text-vt-red">{formatMoney(d.saldo)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-vt-border bg-vt-card p-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-vt-text3">
            Resumen de fiado
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-vt-text2">Clientes con deuda</span>
              <span className="font-semibold text-neutral-900 dark:text-white">{resumen.clientes_con_deuda}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-vt-text2">Deudas activas</span>
              <span className="font-semibold text-neutral-900 dark:text-white">{resumen.total_deudas}</span>
            </div>
            <div className="flex justify-between border-t border-vt-border pt-2">
              <span className="text-vt-text2">Total pendiente</span>
              <span className="font-head font-bold text-vt-red">{formatMoney(resumen.total_pendiente)}</span>
            </div>
          </div>
        </div>
      </div>

      {abonoDeuda && (
        <AbonoModal
          deudaId={abonoDeuda.id}
          clienteNombre={abonoDeuda.cliente_nombre}
          saldo={abonoDeuda.saldo}
          onClose={() => setAbonoDeuda(null)}
        />
      )}
    </div>
  );
}
