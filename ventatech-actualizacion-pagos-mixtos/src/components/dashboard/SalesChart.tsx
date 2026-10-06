"use client";

import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { BarChart3 } from "lucide-react";
import type { VentaDia } from "@/lib/dashboard/queries";
import { formatMoney } from "@/lib/money";

function formatEje(fecha: string) {
  const d = new Date(`${fecha}T00:00:00`);
  return `${String(d.getDate()).padStart(2, "0")}-${d
    .toLocaleDateString("es-DO", { month: "short" })
    .replace(".", "")}`;
}

function CustomTooltip({
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
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-white/10 dark:bg-[#0f1b33]">
      <div className="font-medium text-neutral-500 dark:text-neutral-400">{formatEje(label)}</div>
      <div className="font-semibold text-neutral-900 dark:text-white">
        {formatMoney(payload[0].value)}
      </div>
    </div>
  );
}

type RangoGrafico = "7" | "mes";

export function SalesChart({ data, mesDesde }: { data: VentaDia[]; mesDesde: string }) {
  const [rango, setRango] = useState<RangoGrafico>("mes");

  // "Este mes" empieza el día 1 del mes actual (si hoy es día 1, solo hoy),
  // no 30 días hacia atrás.
  const chartData = useMemo(
    () => (rango === "7" ? data.slice(-7) : data.filter((d) => d.fecha >= mesDesde)),
    [data, rango, mesDesde]
  );
  const totalRango = chartData.reduce((s, d) => s + d.total, 0);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0b1220]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4.5 w-4.5 text-blue-500" />
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
            Ventas — {rango === "7" ? "Últimos 7 días" : "Este mes"}
          </h2>
          <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            · Total {formatMoney(totalRango)}
          </span>
        </div>
        <div className="flex gap-1.5 rounded-lg bg-neutral-100 p-1 dark:bg-white/5">
          {([
            ["7", "7 días"],
            ["mes", "Este mes"],
          ] as const).map(([r, etiqueta]) => (
            <button
              key={r}
              onClick={() => setRango(r)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                rango === r
                  ? "bg-white text-neutral-900 shadow-sm dark:bg-blue-500 dark:text-white"
                  : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-white"
              }`}
            >
              {etiqueta}
            </button>
          ))}
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              className="stroke-neutral-100 dark:stroke-white/5"
            />
            <XAxis
              dataKey="fecha"
              tickFormatter={formatEje}
              tick={{ fontSize: 11, fill: "currentColor" }}
              className="text-neutral-400"
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => `RD$ ${v}`}
              tick={{ fontSize: 11, fill: "currentColor" }}
              className="text-neutral-400"
              axisLine={false}
              tickLine={false}
              width={70}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(59,130,246,0.08)" }} />
            <Bar dataKey="total" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
