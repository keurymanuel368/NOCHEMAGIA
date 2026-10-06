import Link from "next/link";
import type { UltimaVenta } from "@/lib/dashboard/queries";
import { formatMoney } from "@/lib/money";
import { ZONA_NEGOCIO } from "@/lib/fecha-rd";

const PAGO_STYLES: Record<string, string> = {
  efectivo: "bg-green-500/15 text-green-400",
  tarjeta: "bg-blue-500/15 text-blue-400",
  transferencia: "bg-purple-500/15 text-purple-400",
  fiado: "bg-red-500/15 text-red-400",
  mixto: "bg-amber-500/15 text-amber-500",
};

function formatHora(fecha: string) {
  return new Date(fecha).toLocaleTimeString("es-DO", { hour: "numeric", minute: "2-digit", timeZone: ZONA_NEGOCIO });
}

export function UltimasVentasTable({ ventas }: { ventas: UltimaVenta[] }) {
  return (
    <div className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0b1220]">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Últimas Ventas</h2>
        <Link
          href="/pos"
          className="text-xs font-medium text-blue-500 hover:text-blue-600 dark:hover:text-blue-400"
        >
          Ver POS →
        </Link>
      </div>

      {ventas.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Todavía no hay ventas registradas
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-neutral-100 text-[11px] uppercase tracking-wide text-neutral-500 dark:border-white/10 dark:text-neutral-500">
                <th className="pb-2 pr-4 font-medium">Factura</th>
                <th className="pb-2 pr-4 font-medium">Cliente</th>
                <th className="pb-2 pr-4 font-medium">Total</th>
                <th className="pb-2 pr-4 font-medium">Pago</th>
                <th className="pb-2 font-medium">Hora</th>
              </tr>
            </thead>
            <tbody>
              {ventas.map((v) => (
                <tr key={v.id} className="border-b border-neutral-50 last:border-0 dark:border-white/5">
                  <td className="py-2.5 pr-4 font-mono text-xs text-neutral-500 dark:text-neutral-400">
                    {v.numero_factura}
                  </td>
                  <td className="py-2.5 pr-4 text-sm text-neutral-900 dark:text-white">
                    {v.cliente_nombre}
                  </td>
                  <td className="py-2.5 pr-4 text-sm font-semibold text-green-600 dark:text-green-400">
                    {formatMoney(v.total)}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
                        PAGO_STYLES[v.metodo_pago] ?? "bg-neutral-200 text-neutral-600"
                      }`}
                    >
                      {v.metodo_pago}
                    </span>
                  </td>
                  <td className="py-2.5 text-xs text-neutral-400">{formatHora(v.fecha)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
