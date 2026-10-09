"use client";

import { useState, useTransition } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { TrendingUp, TrendingDown, Wallet, Receipt, ShoppingBag, PiggyBank, FileDown } from "lucide-react";
import type { ResumenContable } from "@/lib/contabilidad/types";
import { obtenerResumenAction } from "@/app/actions/contabilidad-actions";
import { formatMoney } from "@/lib/money";
import { StatMini } from "@/components/inventario/StatMini";
import { descargarReportePDF } from "@/lib/contabilidad/reportePdf";
import { useNegocio } from "@/components/providers/NegocioProvider";

function formatEje(fecha: string) {
  const d = new Date(`${fecha}T00:00:00`);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function ResumenTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="rounded-lg border border-vt-border bg-vt-card px-3 py-2 text-xs shadow-lg">
      <div className="font-medium text-vt-text2">{formatEje(label)}</div>
      <div className="font-semibold text-neutral-900 dark:text-white">{formatMoney(payload[0].value)}</div>
    </div>
  );
}

export function ResumenTab({
  resumenInicial,
  desdeInicial,
  hastaInicial,
}: {
  resumenInicial: ResumenContable;
  desdeInicial: string;
  hastaInicial: string;
}) {
  const { nombre: negocioNombre } = useNegocio();
  const [desde, setDesde] = useState(desdeInicial);
  const [hasta, setHasta] = useState(hastaInicial);
  const [resumen, setResumen] = useState(resumenInicial);
  const [pending, startTransition] = useTransition();

  function buscar() {
    startTransition(async () => {
      const r = await obtenerResumenAction(desde, hasta);
      setResumen(r);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
          className="rounded-xl border border-vt-border bg-vt-card px-3 py-2 text-sm outline-none focus:border-vt-blue"
        />
        <span className="text-vt-text3">→</span>
        <input
          type="date"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
          className="rounded-xl border border-vt-border bg-vt-card px-3 py-2 text-sm outline-none focus:border-vt-blue"
        />
        <button
          onClick={buscar}
          disabled={pending}
          className="rounded-xl bg-vt-blue px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Cargando…" : "Buscar"}
        </button>
        <button
          onClick={() => descargarReportePDF(resumen, desde, hasta, negocioNombre)}
          className="ml-auto flex items-center gap-1.5 rounded-xl border border-vt-border px-4 py-2 text-sm font-semibold text-vt-text2 transition hover:bg-vt-card-hover"
        >
          <FileDown className="h-4 w-4" />
          Descargar PDF
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatMini
          icon={ShoppingBag}
          label="Ventas totales"
          value={formatMoney(resumen.ventasTotal)}
          sub={`${resumen.numVentas} venta(s)`}
          accent="from-blue-400 to-blue-600"
        />
        <StatMini
          icon={TrendingUp}
          label="Ingresos reales"
          value={formatMoney(resumen.ingresosReales)}
          sub="ventas - fiado + abonos - devoluciones en efectivo"
          accent="from-green-400 to-green-600"
        />
        <StatMini
          icon={Receipt}
          label="Gastos"
          value={formatMoney(resumen.gastosTotal)}
          sub="del período"
          accent="from-red-400 to-red-600"
        />
        <StatMini
          icon={PiggyBank}
          label="Utilidad"
          value={formatMoney(resumen.utilidad)}
          sub="ingresos - gastos"
          accent={resumen.utilidad >= 0 ? "from-emerald-400 to-emerald-600" : "from-orange-400 to-orange-600"}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            { label: "Efectivo", value: resumen.porMetodo.efectivo, icon: Wallet },
            { label: "Tarjeta", value: resumen.porMetodo.tarjeta, icon: Receipt },
            { label: "Transferencia", value: resumen.porMetodo.transferencia, icon: TrendingUp },
            { label: "Fiado", value: resumen.porMetodo.fiado, icon: TrendingDown },
          ] as const
        ).map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex items-center gap-2.5 rounded-xl border border-vt-border bg-vt-card p-3">
            <Icon className="h-4 w-4 text-vt-text3" />
            <div>
              <div className="text-[11px] text-vt-text3">{label}</div>
              <div className="font-mono text-sm font-bold text-neutral-900 dark:text-white">
                {formatMoney(value)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-vt-border bg-vt-card p-5">
        <h3 className="mb-3 text-sm font-bold text-neutral-900 dark:text-white">Ventas por día</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={resumen.ventasPorDia} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-neutral-100 dark:stroke-white/5" />
              <XAxis dataKey="fecha" tickFormatter={formatEje} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `${v}`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
              <Tooltip content={<ResumenTooltip />} />
              <Bar dataKey="total" fill="#1565C0" radius={[6, 6, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-vt-border bg-vt-card p-5">
          <h3 className="mb-3 text-sm font-bold text-neutral-900 dark:text-white">Top productos</h3>
          {resumen.topProductos.length === 0 ? (
            <p className="text-sm text-vt-text3">Sin ventas en el período</p>
          ) : (
            <div className="flex flex-col divide-y divide-vt-border">
              {resumen.topProductos.map((p) => (
                <div key={p.nombre} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <div className="font-medium text-neutral-900 dark:text-white">{p.nombre}</div>
                    <div className="text-[11px] text-vt-text3">{p.cantidad} unidades</div>
                  </div>
                  <span className="font-mono font-semibold text-vt-blue">{formatMoney(p.monto)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-vt-border bg-vt-card p-5">
          <h3 className="mb-3 text-sm font-bold text-neutral-900 dark:text-white">Gastos por categoría</h3>
          {resumen.gastosPorCategoria.length === 0 ? (
            <p className="text-sm text-vt-text3">Sin gastos en el período</p>
          ) : (
            <div className="flex flex-col divide-y divide-vt-border">
              {resumen.gastosPorCategoria.map((g) => (
                <div key={g.categoria} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-neutral-900 dark:text-white">{g.categoria}</span>
                  <span className="font-mono font-semibold text-vt-red">{formatMoney(g.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
