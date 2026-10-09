"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { registrarDevolucionAction, type ItemDevolucionInput } from "@/app/actions/devoluciones-actions";
import { formatMoney } from "@/lib/money";
import { centavos } from "@/lib/pagos";
import { hoyRD, inicioDiaRD } from "@/lib/fecha-rd";
import { useToast } from "@/components/ui/ToastProvider";

type VentaResultado = {
  id: string;
  numero_factura: string;
  fecha: string;
  total: number;
  cliente_nombre: string;
  metodo_pago: string;
};
type ItemVenta = {
  producto_id: string | null;
  nombre_producto: string;
  cantidad_original: number;
  ya_devuelto: number;
  disponible: number;
  precio_unitario: number;
  /** "unidad" se devuelve en enteros; libra, kg, etc. admiten fracciones. */
  unidad: string;
};

const PASOS = ["Buscar Venta", "Seleccionar Productos", "Confirmar"] as const;

function mapVenta(v: {
  id: string;
  numero_factura: string;
  fecha: string;
  total: number | string;
  metodo_pago: string;
  clientes: { nombre: string } | { nombre: string }[] | null;
}): VentaResultado {
  const cliente = Array.isArray(v.clientes) ? v.clientes[0] : v.clientes;
  return {
    id: v.id,
    numero_factura: v.numero_factura,
    fecha: v.fecha,
    total: Number(v.total),
    cliente_nombre: cliente?.nombre ?? "Cliente General",
    metodo_pago: v.metodo_pago,
  };
}

export function DevolucionWizard({ onRegistrada }: { onRegistrada: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [resultados, setResultados] = useState<VentaResultado[]>([]);
  const [recientes, setRecientes] = useState<VentaResultado[]>([]);
  const [venta, setVenta] = useState<VentaResultado | null>(null);
  const [items, setItems] = useState<ItemVenta[] | null>(null);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [motivo, setMotivo] = useState("");
  const [metodo, setMetodo] = useState<"efectivo" | "credito">("efectivo");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [pasoConfirmar, setPasoConfirmar] = useState(false);
  const pasoActual = !venta ? 1 : pasoConfirmar ? 3 : 2;

  function cantidadTotal(c: Record<string, number>) {
    return Object.values(c).reduce((s, n) => s + n, 0);
  }

  // Ventas recientes del día: para que el cajero no dependa de recordar el
  // número de factura exacto.
  useEffect(() => {
    let cancelado = false;
    const supabase = createClient();
    (async () => {
      // Inicio del día en hora de RD (no según el reloj de la computadora).
      const inicioDia = new Date(inicioDiaRD(hoyRD()));
      const { data } = await supabase
        .from("ventas")
        .select("id, numero_factura, fecha, total, metodo_pago, clientes(nombre)")
        .eq("estado", "completada")
        .gte("fecha", inicioDia.toISOString())
        .order("fecha", { ascending: false })
        .limit(10);
      if (cancelado) return;
      setRecientes((data ?? []).map(mapVenta));
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    let cancelado = false;
    const supabase = createClient();
    const timeout = setTimeout(async () => {
      if (!search.trim() || venta) {
        if (!cancelado) setResultados([]);
        return;
      }
      const q = search.trim();
      const { data } = await supabase
        .from("ventas")
        .select("id, numero_factura, fecha, total, metodo_pago, clientes(nombre)")
        .eq("estado", "completada")
        .or(`numero_factura.ilike.%${q}%`)
        .order("fecha", { ascending: false })
        .limit(8);
      if (cancelado) return;
      setResultados((data ?? []).map(mapVenta));
    }, 300);
    return () => {
      cancelado = true;
      clearTimeout(timeout);
    };
  }, [search, venta]);

  useEffect(() => {
    if (!venta) return;
    let cancelado = false;
    const supabase = createClient();
    (async () => {
      const [{ data: detalle }, { data: devueltos }] = await Promise.all([
        supabase
          .from("venta_items")
          .select("producto_id, nombre_producto, cantidad, precio_unitario, subtotal")
          .eq("venta_id", venta.id),
        supabase
          .from("devoluciones_detalle")
          .select("producto_id, cantidad, devoluciones!inner(venta_id)")
          .eq("devoluciones.venta_id", venta.id),
      ]);
      if (cancelado) return;

      const yaDevueltoPorProducto = new Map<string, number>();
      for (const d of devueltos ?? []) {
        const key = d.producto_id ?? "";
        yaDevueltoPorProducto.set(key, (yaDevueltoPorProducto.get(key) ?? 0) + Number(d.cantidad));
      }

      // Unidad de cada producto (para permitir fracciones en libras, kg...).
      const ids = [...new Set((detalle ?? []).map((d) => d.producto_id).filter(Boolean))] as string[];
      const { data: prods } = ids.length
        ? await supabase.from("productos").select("id, unidad").in("id", ids)
        : { data: [] as { id: string; unidad: string | null }[] };
      if (cancelado) return;
      const unidadPorProducto = new Map((prods ?? []).map((p) => [p.id as string, (p.unidad as string) ?? "unidad"]));

      // Un mismo producto puede venir en varias líneas de la factura: se
      // agrupan, porque lo ya devuelto se cuenta por producto. Antes cada
      // línea restaba todo lo devuelto y la misma cantidad se sumaba dos veces.
      const grupos = new Map<string, { producto_id: string | null; nombre: string; cantidad: number; subtotal: number }>();
      for (const d of detalle ?? []) {
        const key = d.producto_id ?? `rapida:${d.nombre_producto}`;
        const g = grupos.get(key) ?? { producto_id: d.producto_id, nombre: d.nombre_producto, cantidad: 0, subtotal: 0 };
        g.cantidad += Number(d.cantidad);
        g.subtotal += Number(d.subtotal ?? Number(d.cantidad) * Number(d.precio_unitario));
        grupos.set(key, g);
      }

      // Si la venta tuvo descuento o cupón, al cliente se le devuelve lo que
      // realmente pagó por esos productos, no el precio de lista.
      const sumaLineas = [...grupos.values()].reduce((acc, g) => acc + g.subtotal, 0);
      const factor = sumaLineas > 0 ? Math.min(1, venta.total / sumaLineas) : 1;

      const filas: ItemVenta[] = [...grupos.values()].map((g) => {
        const ya = g.producto_id ? yaDevueltoPorProducto.get(g.producto_id) ?? 0 : 0;
        return {
          producto_id: g.producto_id,
          nombre_producto: g.nombre,
          cantidad_original: g.cantidad,
          ya_devuelto: ya,
          // Los artículos de "venta rápida" no son del inventario: no se devuelven aquí.
          disponible: g.producto_id ? Math.max(0, Math.round((g.cantidad - ya) * 1000) / 1000) : 0,
          precio_unitario: g.cantidad > 0 ? (g.subtotal / g.cantidad) * factor : 0,
          unidad: g.producto_id ? unidadPorProducto.get(g.producto_id) ?? "unidad" : "unidad",
        };
      });
      setItems(filas);
    })();
    return () => {
      cancelado = true;
    };
  }, [venta]);

  const total = useMemo(() => {
    if (!items) return 0;
    return items.reduce((s, it) => {
      const key = it.producto_id ?? it.nombre_producto;
      const cant = cantidades[key] ?? 0;
      return s + centavos(cant * it.precio_unitario);
    }, 0);
  }, [items, cantidades]);

  function elegirVenta(v: VentaResultado) {
    setVenta(v);
    setPasoConfirmar(false);
  }

  function volverABuscar() {
    setVenta(null);
    setItems(null);
    setCantidades({});
    setPasoConfirmar(false);
    setSearch("");
    setMotivo("");
    setError(null);
  }

  function confirmar() {
    if (!venta || !items) return;
    const itemsPayload: ItemDevolucionInput[] = items
      .map((it) => ({
        producto_id: it.producto_id ?? "",
        cantidad: cantidades[it.producto_id ?? it.nombre_producto] ?? 0,
      }))
      .filter((it) => it.producto_id && it.cantidad > 0);

    if (itemsPayload.length === 0) return setError("Selecciona al menos un producto a devolver");

    setPending(true);
    setError(null);
    registrarDevolucionAction({ ventaId: venta.id, items: itemsPayload, motivo, metodo }).then((res) => {
      setPending(false);
      if (res.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success("Devolución registrada correctamente");
      router.refresh();
      volverABuscar();
      onRegistrada();
    });
  }

  const listaVentas = search.trim() ? resultados : recientes;
  const tituloLista = search.trim() ? "Resultados" : "Ventas recientes del día";

  return (
    <div className="overflow-hidden rounded-2xl border border-vt-border bg-vt-card">
      <div className="flex border-b border-vt-border">
        {PASOS.map((label, idx) => {
          const num = idx + 1;
          const activo = pasoActual === num;
          const completado = pasoActual > num;
          return (
            <div
              key={label}
              className={`flex flex-1 items-center justify-center gap-2 border-r border-vt-border px-3 py-3 text-xs font-semibold last:border-r-0 sm:text-sm ${
                activo ? "bg-vt-blue/10 text-vt-blue" : completado ? "text-vt-green" : "text-vt-text3"
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${
                  activo
                    ? "border-vt-blue text-vt-blue"
                    : completado
                      ? "border-vt-green bg-vt-green text-white"
                      : "border-vt-border text-vt-text3"
                }`}
              >
                {completado ? <Check className="h-3 w-3" /> : num}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </div>
          );
        })}
      </div>

      <div className="px-6 py-5">
        {!venta ? (
          <>
            <label className="mb-1 block text-xs font-semibold uppercase text-vt-text3">
              Número de factura o ID de venta
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vt-text3" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ej: VT-20250312-000001"
                className="w-full rounded-xl border border-vt-border bg-vt-bg py-2.5 pl-10 pr-3 text-sm outline-none focus:border-vt-blue"
              />
            </div>

            <div className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wide text-vt-text3">
              {tituloLista}
            </div>
            <div className="flex flex-col gap-2">
              {listaVentas.map((v) => (
                <button
                  key={v.id}
                  onClick={() => elegirVenta(v)}
                  className="flex items-center justify-between rounded-xl border border-vt-border bg-vt-bg px-3.5 py-2.5 text-left transition hover:border-vt-blue hover:bg-vt-card-hover"
                >
                  <div>
                    <div className="font-mono text-xs text-vt-blue">{v.numero_factura}</div>
                    <div className="text-sm font-semibold text-neutral-900 dark:text-white">
                      {v.cliente_nombre}
                      <span className="ml-1.5 font-normal text-vt-text3">
                        · {new Date(v.fecha).toLocaleString("es-DO")} · {v.metodo_pago}
                      </span>
                    </div>
                  </div>
                  <span className="font-mono text-sm font-bold text-vt-blue">{formatMoney(v.total)}</span>
                </button>
              ))}
              {search.trim() && resultados.length === 0 && (
                <p className="py-6 text-center text-sm text-vt-text3">Sin resultados</p>
              )}
              {!search.trim() && recientes.length === 0 && (
                <p className="py-6 text-center text-sm text-vt-text3">Sin ventas registradas hoy</p>
              )}
            </div>
          </>
        ) : !pasoConfirmar ? (
          <>
            <button onClick={volverABuscar} className="mb-3 text-xs font-medium text-vt-blue hover:underline">
              ← Buscar otra factura
            </button>

            <div className="mb-3 rounded-xl border border-vt-border bg-vt-bg px-3.5 py-2.5">
              <div className="font-mono text-xs text-vt-blue">{venta.numero_factura}</div>
              <div className="text-sm font-semibold text-neutral-900 dark:text-white">
                {venta.cliente_nombre}
              </div>
            </div>

            {items === null ? (
              <p className="py-8 text-center text-sm text-vt-text3">Cargando artículos…</p>
            ) : (
              <div className="flex flex-col gap-2">
                {items.map((it) => {
                  const key = it.producto_id ?? it.nombre_producto;
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-xl border border-vt-border bg-vt-bg px-3.5 py-2.5"
                    >
                      <div>
                        <div className="text-sm font-semibold text-neutral-900 dark:text-white">
                          {it.nombre_producto}
                        </div>
                        <div className="text-[11px] text-vt-text3">
                          {it.producto_id
                            ? `Disponible para devolver: ${it.disponible} · ${formatMoney(it.precio_unitario)} c/u (lo que pagó)`
                            : "Venta rápida: no es del inventario, no se devuelve aquí"}
                        </div>
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={it.disponible}
                        step={it.unidad.trim().toLowerCase() === "unidad" ? "1" : "0.001"}
                        disabled={it.disponible <= 0}
                        value={cantidades[key] ?? ""}
                        onChange={(e) =>
                          setCantidades((prev) => ({
                            ...prev,
                            [key]: Math.min(
                              it.disponible,
                              Math.max(
                                0,
                                it.unidad.trim().toLowerCase() === "unidad"
                                  ? Math.floor(Number(e.target.value) || 0)
                                  : Math.round((Number(e.target.value) || 0) * 1000) / 1000
                              )
                            ),
                          }))
                        }
                        placeholder="0"
                        className="w-16 rounded-lg border border-vt-border bg-vt-card px-2 py-1.5 text-center text-sm outline-none focus:border-vt-blue disabled:opacity-40"
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  if (cantidadTotal(cantidades) === 0) {
                    setError("Selecciona al menos un producto a devolver");
                    return;
                  }
                  setError(null);
                  setPasoConfirmar(true);
                }}
                disabled={items === null}
                className="rounded-xl bg-vt-blue px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                Continuar
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              onClick={() => setPasoConfirmar(false)}
              className="mb-3 text-xs font-medium text-vt-blue hover:underline"
            >
              ← Editar productos
            </button>

            <div className="mb-3 rounded-xl border border-vt-border bg-vt-bg px-3.5 py-2.5">
              <div className="font-mono text-xs text-vt-blue">{venta.numero_factura}</div>
              <div className="text-sm font-semibold text-neutral-900 dark:text-white">
                {venta.cliente_nombre}
              </div>
            </div>

            <div className="mb-4 flex flex-col gap-1.5 rounded-xl border border-vt-border bg-vt-bg p-3.5">
              {items
                ?.filter((it) => (cantidades[it.producto_id ?? it.nombre_producto] ?? 0) > 0)
                .map((it) => {
                  const key = it.producto_id ?? it.nombre_producto;
                  const cant = cantidades[key] ?? 0;
                  return (
                    <div key={key} className="flex items-center justify-between text-sm">
                      <span className="text-neutral-900 dark:text-white">
                        {cant} × {it.nombre_producto}
                      </span>
                      <span className="font-mono text-vt-text2">{formatMoney(centavos(cant * it.precio_unitario))}</span>
                    </div>
                  );
                })}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-vt-text3">Motivo</label>
              <input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: Producto defectuoso"
                className="w-full rounded-xl border border-vt-border bg-vt-bg px-3.5 py-2.5 text-sm outline-none focus:border-vt-blue"
              />
            </div>

            <div className="mt-3">
              <label className="mb-1 block text-xs font-semibold uppercase text-vt-text3">
                Método de devolución
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMetodo("efectivo")}
                  className={`rounded-xl border py-2 text-sm font-semibold transition ${
                    metodo === "efectivo"
                      ? "border-vt-blue bg-vt-blue/10 text-vt-blue"
                      : "border-vt-border text-vt-text2 hover:bg-vt-card-hover"
                  }`}
                >
                  💵 Efectivo
                </button>
                <button
                  onClick={() => setMetodo("credito")}
                  className={`rounded-xl border py-2 text-sm font-semibold transition ${
                    metodo === "credito"
                      ? "border-vt-blue bg-vt-blue/10 text-vt-blue"
                      : "border-vt-border text-vt-text2 hover:bg-vt-card-hover"
                  }`}
                >
                  📒 Crédito cliente
                </button>
              </div>
            </div>

            <div className="mt-4 flex justify-between border-t border-vt-border pt-3 font-head text-base font-extrabold text-vt-blue">
              <span>Total a devolver</span>
              <span>{formatMoney(total)}</span>
            </div>

            {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="mt-4 flex justify-end">
              <button
                onClick={confirmar}
                disabled={pending || total <= 0}
                className="rounded-xl bg-vt-blue px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {pending ? "Procesando…" : "Registrar devolución"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
