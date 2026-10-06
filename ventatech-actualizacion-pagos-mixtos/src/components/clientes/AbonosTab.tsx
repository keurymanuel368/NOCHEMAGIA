"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { traerTodas } from "@/lib/supabase/paginar";
import { formatMoney } from "@/lib/money";
import { hoyRD, rangoDiasRD } from "@/lib/fecha-rd";

type AbonoRow = {
  id: string;
  cliente_nombre: string;
  monto: number;
  metodo_pago: string;
  cajero_nombre: string;
  fecha: string;
  notas: string | null;
};

function hoyISO() {
  return hoyRD();
}

export function AbonosTab() {
  const [fecha, setFecha] = useState(hoyISO());
  const [abonos, setAbonos] = useState<AbonoRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    const supabase = createClient();
    (async () => {
      const { desdeISO: desde, hastaISO: hasta } = rangoDiasRD(fecha, fecha);
      const { data } = await traerTodas((a, b) =>
        supabase
          .from("abonos")
          .select("id, monto, metodo_pago, fecha, notas, clientes(nombre), usuarios(nombre)")
          .gte("fecha", desde)
          .lt("fecha", hasta)
          .order("fecha", { ascending: false })
          .order("id", { ascending: false })
          .range(a, b)
      );
      if (cancelado) return;
      setAbonos(
        (data ?? []).map((a) => ({
          id: a.id,
          cliente_nombre: (a.clientes as unknown as { nombre: string } | null)?.nombre ?? "—",
          monto: Number(a.monto),
          metodo_pago: a.metodo_pago,
          cajero_nombre: (a.usuarios as unknown as { nombre: string } | null)?.nombre ?? "—",
          fecha: a.fecha,
          notas: a.notas,
        }))
      );
      setLoading(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [fecha]);

  const total = abonos.reduce((s, a) => s + a.monto, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="rounded-xl border border-vt-border bg-vt-card px-3 py-2.5 text-sm outline-none focus:border-vt-blue"
        />
        <span className="ml-auto font-head text-lg font-extrabold text-vt-green">
          {formatMoney(total)}
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-vt-border bg-vt-card">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-vt-border text-[11px] uppercase tracking-wide text-vt-text3">
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Monto</th>
              <th className="px-4 py-3 font-medium">Método</th>
              <th className="px-4 py-3 font-medium">Cajero</th>
              <th className="px-4 py-3 font-medium">Hora</th>
              <th className="px-4 py-3 font-medium">Notas</th>
            </tr>
          </thead>
          <tbody>
            {abonos.map((a) => (
              <tr key={a.id} className="border-b border-vt-border last:border-0 hover:bg-vt-card-hover">
                <td className="px-4 py-3 text-sm font-semibold text-neutral-900 dark:text-white">
                  {a.cliente_nombre}
                </td>
                <td className="px-4 py-3 font-mono text-sm font-bold text-vt-green">
                  {formatMoney(a.monto)}
                </td>
                <td className="px-4 py-3 text-sm capitalize text-vt-text2">{a.metodo_pago}</td>
                <td className="px-4 py-3 text-sm text-vt-text2">{a.cajero_nombre}</td>
                <td className="px-4 py-3 text-xs text-vt-text3">
                  {new Date(a.fecha).toLocaleTimeString("es-DO", { hour: "numeric", minute: "2-digit" })}
                </td>
                <td className="px-4 py-3 text-xs text-vt-text3">{a.notas ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && abonos.length === 0 && (
          <div className="py-10 text-center text-sm text-vt-text3">Sin abonos este día</div>
        )}
        {loading && <div className="py-10 text-center text-sm text-vt-text3">Cargando…</div>}
      </div>
    </div>
  );
}
