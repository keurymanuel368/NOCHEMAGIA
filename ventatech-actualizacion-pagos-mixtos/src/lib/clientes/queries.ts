import "server-only";
import { createClient } from "@/lib/supabase/server";
import { traerTodas } from "@/lib/supabase/paginar";
import { hoyRD, inicioDiaRD, rangoDiasRD } from "@/lib/fecha-rd";
import type { Cliente, Deuda, Abono, ClientesStats, FiadoResumen } from "./types";

type ClienteConTotalesRow = {
  id: string;
  nombre: string;
  cedula: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  limite_credito: number;
  saldo_deuda: number;
  activo: boolean;
  total_compras: number;
  total_gastado: number;
  ultima_compra: string | null;
};

export async function getClientes(): Promise<Cliente[]> {
  const supabase = await createClient();
  // La suma de compras por cliente se calcula con un GROUP BY dentro de
  // la base de datos (función clientes_con_totales): con miles de ventas,
  // traerlas todas a JavaScript para sumarlas a mano sería muy lento.
  // Todos los clientes, por páginas de 1000.
  const { data } = await traerTodas<ClienteConTotalesRow>(
    (a, b) =>
      supabase
        .rpc("clientes_con_totales")
        .order("nombre", { ascending: true })
        .order("id", { ascending: true })
        .range(a, b) as unknown as PromiseLike<{
        data: ClienteConTotalesRow[] | null;
        error: { message: string } | null;
      }>
  );

  return (data ?? []).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    cedula: c.cedula,
    telefono: c.telefono,
    email: c.email,
    direccion: c.direccion,
    limite_credito: Number(c.limite_credito),
    saldo_deuda: Number(c.saldo_deuda),
    activo: c.activo,
    total_compras: Number(c.total_compras),
    total_gastado: Number(c.total_gastado),
    ultima_compra: c.ultima_compra,
  }));
}

export async function getClientesStats(): Promise<ClientesStats> {
  const supabase = await createClient();
  const hoyInicio = inicioDiaRD(hoyRD());

  const [{ data: clientes }, { data: abonosHoy }] = await Promise.all([
    traerTodas((a, b) =>
      supabase.from("clientes").select("saldo_deuda").eq("activo", true).order("id").range(a, b)
    ),
    traerTodas((a, b) => supabase.from("abonos").select("monto").gte("fecha", hoyInicio).order("id").range(a, b)),
  ]);

  const rows = clientes ?? [];
  return {
    total_clientes: rows.length,
    con_deuda: rows.filter((c) => Number(c.saldo_deuda) > 0).length,
    total_deuda: rows.reduce((s, c) => s + Number(c.saldo_deuda), 0),
    abonos_hoy: (abonosHoy ?? []).reduce((s, a) => s + Number(a.monto), 0),
  };
}

export async function getDeudas(estado: "pendiente" | "pagada" | "todas" = "pendiente"): Promise<Deuda[]> {
  const supabase = await createClient();
  // Todas las deudas (antes se mostraban solo las últimas 200).
  const { data } = await traerTodas((a, b) => {
    let query = supabase
      .from("deudas")
      .select(
        "id, cliente_id, venta_id, monto_original, monto_pagado, saldo, estado, fecha, clientes(nombre, cedula, telefono), ventas(numero_factura)"
      );
    if (estado === "pendiente") query = query.in("estado", ["pendiente", "parcial"]);
    else if (estado === "pagada") query = query.eq("estado", "pagada");
    return query.order("fecha", { ascending: false }).order("id", { ascending: false }).range(a, b);
  });

  return (data ?? []).map((d) => ({
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
  }));
}

export async function getFiadoResumen(): Promise<FiadoResumen> {
  const supabase = await createClient();
  const { data } = await traerTodas((a, b) =>
    supabase
      .from("deudas")
      .select("cliente_id, saldo")
      .in("estado", ["pendiente", "parcial"])
      .order("id")
      .range(a, b)
  );

  const rows = data ?? [];
  return {
    clientes_con_deuda: new Set(rows.map((r) => r.cliente_id)).size,
    total_pendiente: rows.reduce((s, r) => s + Number(r.saldo), 0),
    total_deudas: rows.length,
  };
}

export async function getTopDeudores(limit = 5): Promise<{ nombre: string; saldo: number }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clientes")
    .select("nombre, saldo_deuda")
    .gt("saldo_deuda", 0)
    .order("saldo_deuda", { ascending: false })
    .limit(limit);
  return (data ?? []).map((c) => ({ nombre: c.nombre, saldo: Number(c.saldo_deuda) }));
}

export async function getAbonosDelDia(fecha: string): Promise<{ abonos: Abono[]; total: number }> {
  const supabase = await createClient();
  const { desdeISO: desde, hastaISO: hasta } = rangoDiasRD(fecha, fecha);
  const { data } = await traerTodas((a, b) =>
    supabase
      .from("abonos")
      .select("id, cliente_id, deuda_id, monto, metodo_pago, fecha, notas, clientes(nombre), usuarios(nombre)")
      .gte("fecha", desde)
      .lt("fecha", hasta)
      .order("fecha", { ascending: false })
      .order("id", { ascending: false })
      .range(a, b)
  );

  const abonos = (data ?? []).map((a) => ({
    id: a.id,
    cliente_id: a.cliente_id,
    cliente_nombre: (a.clientes as unknown as { nombre: string } | null)?.nombre ?? "—",
    deuda_id: a.deuda_id,
    monto: Number(a.monto),
    metodo_pago: a.metodo_pago,
    fecha: a.fecha,
    cajero_nombre: (a.usuarios as unknown as { nombre: string } | null)?.nombre ?? "—",
    notas: a.notas,
  }));

  return { abonos, total: abonos.reduce((s, a) => s + a.monto, 0) };
}
