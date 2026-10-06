"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { imprimirFactura } from "@/lib/pos/print";
import { useNegocio } from "@/components/providers/NegocioProvider";
import { useToast } from "@/components/ui/ToastProvider";
import { lineasPago, textoMetodoPago, type PagoFila } from "@/lib/pagos";

// Reimprime una factura ya emitida, marcada como COPIA. Pensado para el
// fiado: cuando el cliente vuelve días después a pagar, se le entrega una
// copia con lo que ya abonó y el saldo que le queda.
export function BotonCopiaFactura({ ventaId, className }: { ventaId: string; className?: string }) {
  const { nombre: negocioNombre } = useNegocio();
  const toast = useToast();
  const [imprimiendo, setImprimiendo] = useState(false);

  async function imprimirCopia() {
    setImprimiendo(true);
    try {
      const supabase = createClient();
      const [{ data: venta }, { data: items }, { data: deudas }, { data: pagosData }] = await Promise.all([
        supabase
          .from("ventas")
          .select("numero_factura, fecha, ncf, subtotal, descuento, total, metodo_pago, clientes(nombre), usuarios(nombre)")
          .eq("id", ventaId)
          .single(),
        supabase
          .from("venta_items")
          .select("nombre_producto, cantidad, subtotal")
          .eq("venta_id", ventaId),
        supabase.from("deudas").select("monto_pagado, saldo").eq("venta_id", ventaId),
        supabase.from("venta_pagos").select("metodo, tipo_tarjeta, monto").eq("venta_id", ventaId),
      ]);
      const pagos = (pagosData ?? []) as PagoFila[];
      if (!venta) {
        toast.error("No se encontró la factura");
        return;
      }

      const deuda = deudas?.[0];
      await imprimirFactura({
        negocioNombre,
        numeroFactura: venta.numero_factura,
        ncf: venta.ncf ?? undefined,
        fecha: venta.fecha,
        cajero: (venta.usuarios as unknown as { nombre: string } | null)?.nombre ?? "—",
        cliente: (venta.clientes as unknown as { nombre: string } | null)?.nombre ?? "General",
        metodoPago: textoMetodoPago(venta.metodo_pago, pagos),
        pagos: pagos.length > 1 ? lineasPago(pagos) : undefined,
        items: (items ?? []).map((i) => ({
          nombre: i.nombre_producto,
          cantidad: Number(i.cantidad),
          subtotal: Number(i.subtotal),
        })),
        subtotal: Number(venta.subtotal),
        descuento: Number(venta.descuento),
        total: Number(venta.total),
        esCopia: true,
        pagado: deuda ? Number(deuda.monto_pagado) : undefined,
        saldoPendiente: deuda ? Number(deuda.saldo) : undefined,
      });
    } catch {
      toast.error("No se pudo imprimir la copia");
    } finally {
      setImprimiendo(false);
    }
  }

  return (
    <button
      type="button"
      onClick={imprimirCopia}
      disabled={imprimiendo}
      title="Imprimir copia de la factura"
      className={
        className ??
        "flex items-center gap-1 rounded-lg border border-vt-border px-2.5 py-1 text-xs font-semibold text-vt-text2 hover:border-vt-blue hover:text-vt-blue disabled:opacity-60"
      }
    >
      <Printer className="h-3.5 w-3.5" />
      {imprimiendo ? "Imprimiendo…" : "Copia"}
    </button>
  );
}
