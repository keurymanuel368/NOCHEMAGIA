"use client";

import { useEffect, useState, useTransition } from "react";
import { X, Receipt, Ban } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/money";
import { BotonCopiaFactura } from "./BotonCopiaFactura";
import { lineasPago, textoMetodoPago, type PagoFila } from "@/lib/pagos";
import { anularVentaAction, puedeAnularFacturasAction } from "@/app/actions/pos-actions";
import { useToast } from "@/components/ui/ToastProvider";

type Anulacion = { motivo: string; anulada_por_nombre: string | null; anulada_at: string; en_modo_soporte: boolean };

type Detalle = {
  numero_factura: string;
  fecha: string;
  total: number;
  subtotal: number;
  descuento: number;
  metodo_pago: string;
  estado: string;
  anulacion: Anulacion | null;
  pagos: PagoFila[];
  cliente_nombre: string;
  cajero_nombre: string;
  items: { nombre_producto: string; cantidad: number; precio_unitario: number; subtotal: number }[];
};

export function VentaDetalleModal({
  ventaId,
  onClose,
  onAnulada,
}: {
  ventaId: string;
  onClose: () => void;
  /** Se llama después de anular, para refrescar la lista. */
  onAnulada?: () => void;
}) {
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [puedeAnular, setPuedeAnular] = useState(false);
  const [anulando, setAnulando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [recarga, setRecarga] = useState(0);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  // El servidor decide si este usuario puede anular (admin o super admin en
  // modo soporte); el botón solo se muestra si puede.
  useEffect(() => {
    puedeAnularFacturasAction().then(setPuedeAnular).catch(() => setPuedeAnular(false));
  }, []);

  function confirmarAnulacion() {
    if (motivo.trim().length < 3) {
      toast.error("Escribe el motivo de la anulación");
      return;
    }
    startTransition(async () => {
      const res = await anularVentaAction(ventaId, motivo);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Factura anulada. Los productos volvieron al inventario.");
      setAnulando(false);
      setMotivo("");
      setRecarga((n) => n + 1);
      onAnulada?.();
    });
  }

  useEffect(() => {
    let cancelado = false;
    const supabase = createClient();
    (async () => {
      const [{ data: venta }, { data: items }, { data: pagos }, { data: anulacion }] = await Promise.all([
        supabase
          .from("ventas")
          .select(
            "numero_factura, fecha, total, subtotal, descuento, metodo_pago, estado, clientes(nombre), usuarios(nombre)"
          )
          .eq("id", ventaId)
          .single(),
        supabase
          .from("venta_items")
          .select("nombre_producto, cantidad, precio_unitario, subtotal")
          .eq("venta_id", ventaId),
        // Si la tabla no existe todavía, simplemente no hay desglose.
        supabase.from("venta_pagos").select("metodo, tipo_tarjeta, monto").eq("venta_id", ventaId),
        supabase
          .from("ventas_anuladas")
          .select("motivo, anulada_por_nombre, anulada_at, en_modo_soporte")
          .eq("venta_id", ventaId)
          .maybeSingle(),
      ]);
      if (cancelado || !venta) return;
      setDetalle({
        numero_factura: venta.numero_factura,
        fecha: venta.fecha,
        total: Number(venta.total),
        subtotal: Number(venta.subtotal),
        descuento: Number(venta.descuento),
        metodo_pago: venta.metodo_pago,
        estado: venta.estado,
        anulacion: (anulacion as Anulacion | null) ?? null,
        pagos: (pagos ?? []) as PagoFila[],
        cliente_nombre:
          (venta.clientes as unknown as { nombre: string } | null)?.nombre ?? "General",
        cajero_nombre:
          (venta.usuarios as unknown as { nombre: string } | null)?.nombre ?? "—",
        items: items ?? [],
      });
    })();
    return () => {
      cancelado = true;
    };
  }, [ventaId, recarga]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-vt-card"
        style={{ boxShadow: "var(--shadow-vt-lg)" }}
      >
        <div className="flex items-center justify-between border-b border-vt-border px-6 py-4">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-vt-blue" />
            <h2 className="font-head text-base font-bold text-neutral-900 dark:text-white">
              {detalle?.numero_factura ?? "Cargando…"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {detalle && <BotonCopiaFactura ventaId={ventaId} />}
            <button onClick={onClose} className="text-vt-text3 hover:text-neutral-600">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {!detalle ? (
          <div className="px-6 py-10 text-center text-sm text-vt-text3">Cargando…</div>
        ) : (
          <div className="max-h-[80vh] overflow-y-auto px-6 py-4">
            {detalle.estado === "anulada" && (
              <div className="mb-3 rounded-xl border border-vt-red/30 bg-vt-red/10 px-3 py-2 text-sm text-vt-red">
                <div className="font-bold">Factura anulada</div>
                {detalle.anulacion && (
                  <div className="mt-0.5 text-xs">
                    {detalle.anulacion.motivo} · {detalle.anulacion.anulada_por_nombre ?? "—"} ·{" "}
                    {new Date(detalle.anulacion.anulada_at).toLocaleString("es-DO")}
                  </div>
                )}
              </div>
            )}
            <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-xs text-vt-text3">Cliente</div>
                <div className="font-semibold text-neutral-900 dark:text-white">
                  {detalle.cliente_nombre}
                </div>
              </div>
              <div>
                <div className="text-xs text-vt-text3">Cajero</div>
                <div className="font-semibold text-neutral-900 dark:text-white">
                  {detalle.cajero_nombre}
                </div>
              </div>
              <div>
                <div className="text-xs text-vt-text3">Fecha</div>
                <div className="font-mono text-xs text-neutral-700 dark:text-neutral-300">
                  {new Date(detalle.fecha).toLocaleString("es-DO")}
                </div>
              </div>
              <div>
                <div className="text-xs text-vt-text3">Método</div>
                <div className="font-semibold capitalize text-neutral-900 dark:text-white">
                  {textoMetodoPago(detalle.metodo_pago, detalle.pagos)}
                </div>
                {detalle.pagos.length > 1 &&
                  lineasPago(detalle.pagos).map((l, i) => (
                    <div key={i} className="text-xs text-vt-text2">
                      {l.etiqueta}: <span className="font-mono">{formatMoney(l.monto)}</span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto rounded-xl border border-vt-border">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-vt-border bg-[#F8FAFF] text-[11px] uppercase text-vt-text3 dark:bg-white/[0.03]">
                    <th className="px-3 py-2 font-medium">Producto</th>
                    <th className="px-3 py-2 text-right font-medium">Cant.</th>
                    <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.items.map((it, idx) => (
                    <tr key={idx} className="border-b border-vt-border last:border-0">
                      <td className="px-3 py-2 text-neutral-900 dark:text-white">
                        {it.nombre_producto}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-vt-text2">
                        {it.cantidad}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-neutral-900 dark:text-white">
                        {formatMoney(it.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex flex-col gap-1 text-sm">
              <div className="flex justify-between text-vt-text2">
                <span>Subtotal</span>
                <span>{formatMoney(detalle.subtotal)}</span>
              </div>
              {detalle.descuento > 0 && (
                <div className="flex justify-between text-vt-text2">
                  <span>Descuento</span>
                  <span>-{formatMoney(detalle.descuento)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-vt-border pt-1.5 font-head text-base font-extrabold text-vt-green">
                <span>Total</span>
                <span>{formatMoney(detalle.total)}</span>
              </div>
            </div>

            {puedeAnular && detalle.estado === "completada" && !anulando && (
              <button
                onClick={() => setAnulando(true)}
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-vt-red/40 py-2 text-sm font-semibold text-vt-red transition hover:bg-vt-red/10"
              >
                <Ban className="h-4 w-4" />
                Anular factura
              </button>
            )}

            {anulando && (
              <div className="mt-4 rounded-xl border border-vt-red/30 bg-vt-red/5 p-3">
                <div className="text-sm font-semibold text-neutral-900 dark:text-white">
                  ¿Anular {detalle.numero_factura} por {formatMoney(detalle.total)}?
                </div>
                <p className="mt-1 text-xs text-vt-text2">
                  Los productos vuelven al inventario, la venta sale de caja, dashboard y reportes, y
                  queda registrado quién la anuló y por qué.
                </p>
                <input
                  autoFocus
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Motivo (ej.: factura cobrada dos veces)"
                  className="mt-2 w-full rounded-lg border border-vt-border bg-vt-card px-3 py-2 text-sm outline-none focus:border-vt-red"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => {
                      setAnulando(false);
                      setMotivo("");
                    }}
                    className="flex-1 rounded-lg border border-vt-border py-2 text-sm font-semibold text-vt-text2"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmarAnulacion}
                    disabled={pending}
                    className="flex-1 rounded-lg bg-vt-red py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {pending ? "Anulando…" : "Sí, anular"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
