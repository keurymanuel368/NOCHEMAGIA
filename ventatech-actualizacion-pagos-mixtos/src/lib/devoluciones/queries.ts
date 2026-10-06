import "server-only";
import { createClient } from "@/lib/supabase/server";
import { traerTodas } from "@/lib/supabase/paginar";
import { hoyRD, inicioDiaRD, inicioMes, rangoDiasRD } from "@/lib/fecha-rd";
import type { Devolucion, DevolucionesStats } from "./types";

export async function getDevoluciones(desde: string, hasta: string): Promise<{ devoluciones: Devolucion[]; total: number }> {
  const supabase = await createClient();
  const { data } = await traerTodas((a, b) =>
    supabase
      .from("devoluciones")
      .select(
        "id, venta_id, motivo, total_devuelto, metodo_devolucion, fecha, ventas(numero_factura, clientes(nombre)), usuarios(nombre)"
      )
      .gte("fecha", rangoDiasRD(desde, hasta).desdeISO)
      .lt("fecha", rangoDiasRD(desde, hasta).hastaISO)
      .order("fecha", { ascending: false })
      .order("id", { ascending: false })
      .range(a, b)
  );

  const devoluciones = (data ?? []).map((d) => {
    const venta = d.ventas as unknown as { numero_factura: string; clientes: { nombre: string } | null } | null;
    return {
      id: d.id,
      venta_id: d.venta_id,
      numero_factura: venta?.numero_factura ?? "—",
      cliente_nombre: venta?.clientes?.nombre ?? "Cliente General",
      cajero_nombre: (d.usuarios as unknown as { nombre: string } | null)?.nombre ?? "—",
      motivo: d.motivo,
      total_devuelto: Number(d.total_devuelto),
      metodo_devolucion: d.metodo_devolucion,
      fecha: d.fecha,
    };
  });

  return { devoluciones, total: devoluciones.reduce((s, d) => s + d.total_devuelto, 0) };
}

export async function getDevolucionesStats(): Promise<DevolucionesStats> {
  const supabase = await createClient();
  const fechaHoy = hoyRD();
  const hoyInicio = inicioDiaRD(fechaHoy);
  const mesInicio = inicioDiaRD(inicioMes(fechaHoy));

  const [{ data: hoy }, { data: mes }] = await Promise.all([
    traerTodas((a, b) =>
      supabase.from("devoluciones").select("total_devuelto").gte("fecha", hoyInicio).order("id").range(a, b)
    ),
    traerTodas((a, b) =>
      supabase.from("devoluciones").select("total_devuelto").gte("fecha", mesInicio).order("id").range(a, b)
    ),
  ]);

  return {
    hoy_cnt: (hoy ?? []).length,
    hoy_monto: (hoy ?? []).reduce((s, d) => s + Number(d.total_devuelto), 0),
    mes_cnt: (mes ?? []).length,
    mes_monto: (mes ?? []).reduce((s, d) => s + Number(d.total_devuelto), 0),
  };
}
