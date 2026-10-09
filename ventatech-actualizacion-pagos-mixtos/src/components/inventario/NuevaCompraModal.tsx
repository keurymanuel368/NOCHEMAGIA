"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, ScanLine, ShoppingCart, Trash2 } from "lucide-react";
import type { ProductoInventario, Proveedor } from "@/lib/inventario/types";
import { registrarCompraAction, type CompraItemInput } from "@/app/actions/inventario-actions";
import { formatMoney } from "@/lib/money";
import { centavos } from "@/lib/pagos";
import { reproducirBeep } from "@/lib/pos/beep";

type Linea = { producto_id: string; nombre: string; cantidad: number; precio_unitario: number };

export function NuevaCompraModal({
  productos,
  proveedores,
  onClose,
}: {
  productos: ProductoInventario[];
  proveedores: Proveedor[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [proveedorId, setProveedorId] = useState("");
  const [notas, setNotas] = useState("");
  const [search, setSearch] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  const sugerencias = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.trim().toLowerCase();
    return productos
      .filter((p) => p.nombre.toLowerCase().includes(q) || (p.codigo_barras ?? "").includes(q))
      .slice(0, 8);
  }, [search, productos]);

  function agregar(p: ProductoInventario) {
    setLineas((prev) => {
      if (prev.some((l) => l.producto_id === p.id)) {
        return prev.map((l) =>
          l.producto_id === p.id ? { ...l, cantidad: l.cantidad + 1 } : l
        );
      }
      return [...prev, { producto_id: p.id, nombre: p.nombre, cantidad: 1, precio_unitario: p.precio_compra }];
    });
    setSearch("");
    setScanError(null);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const codigo = search.trim();
    if (!codigo) return;

    // Igual que en el POS: un escáner entrega el código exacto, así que se
    // prueba primero antes de depender del filtro de texto parcial.
    const porCodigo = productos.find((p) => p.codigo_barras === codigo);
    if (porCodigo) {
      reproducirBeep();
      agregar(porCodigo);
      searchRef.current?.focus();
      return;
    }

    if (sugerencias.length === 1) {
      reproducirBeep();
      agregar(sugerencias[0]);
      searchRef.current?.focus();
      return;
    }

    setScanError(
      sugerencias.length === 0
        ? `No se encontró ningún producto para "${codigo}"`
        : `Hay ${sugerencias.length} productos que coinciden, especifica más`
    );
  }

  function actualizar(id: string, campo: "cantidad" | "precio_unitario", valor: number) {
    // Nunca negativos: una cantidad negativa le restaba inventario a la compra.
    const limpio = Number.isFinite(valor) ? Math.max(0, valor) : 0;
    const v = campo === "cantidad" ? Math.round(limpio * 1000) / 1000 : centavos(limpio);
    setLineas((prev) => prev.map((l) => (l.producto_id === id ? { ...l, [campo]: v } : l)));
  }

  function quitar(id: string) {
    setLineas((prev) => prev.filter((l) => l.producto_id !== id));
  }

  const total = centavos(lineas.reduce((s, l) => s + centavos(l.cantidad * l.precio_unitario), 0));

  function confirmar() {
    if (lineas.length === 0) return setError("Agrega al menos un producto");
    if (lineas.some((l) => !(l.cantidad > 0))) return setError("Cada producto debe tener una cantidad mayor que cero");
    const items: CompraItemInput[] = lineas.map((l) => ({
      producto_id: l.producto_id,
      cantidad: l.cantidad,
      precio_unitario: l.precio_unitario,
    }));
    startTransition(async () => {
      const res = await registrarCompraAction({ items, proveedorId: proveedorId || null, notas });
      if (res.error) return setError(res.error);
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-vt-card"
        style={{ boxShadow: "var(--shadow-vt-lg)" }}
      >
        <div className="flex items-center justify-between border-b border-vt-border px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-neutral-900 dark:text-white">
            <ShoppingCart className="h-5 w-5 text-vt-blue" />
            Nueva Compra / Entrada de Inventario
          </h2>
          <button onClick={onClose} className="text-vt-text3 hover:text-neutral-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-vt-text3">
                Proveedor (opcional)
              </label>
              <select
                value={proveedorId}
                onChange={(e) => setProveedorId(e.target.value)}
                className="w-full rounded-xl border border-vt-border bg-vt-bg px-3 py-2.5 text-sm outline-none focus:border-vt-blue"
              >
                <option value="">Sin proveedor</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-vt-text3">Notas</label>
              <input
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Ej: Pedido semanal"
                className="w-full rounded-xl border border-vt-border bg-vt-bg px-3 py-2.5 text-sm outline-none focus:border-vt-blue"
              />
            </div>
          </div>

          <label className="mb-1 block text-xs font-semibold uppercase text-vt-text3">
            Agregar producto
          </label>
          <div className="relative mb-3">
            <input
              ref={searchRef}
              autoFocus
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (scanError) setScanError(null);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Buscar o escanear código de barras…"
              className={`w-full rounded-xl border bg-vt-bg px-3.5 py-2.5 pr-9 text-sm outline-none ${
                scanError ? "border-vt-red focus:border-vt-red" : "border-vt-border focus:border-vt-blue"
              }`}
            />
            <ScanLine className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vt-text3" />
            {scanError && <p className="mt-1 text-xs font-medium text-vt-red">{scanError}</p>}
            {sugerencias.length > 0 && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-vt-border bg-vt-card shadow-lg">
                {sugerencias.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => agregar(p)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-vt-card-hover"
                  >
                    <span>{p.nombre}</span>
                    <span className="text-xs text-vt-text3">{formatMoney(p.precio_compra)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-vt-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-vt-border text-[11px] uppercase text-vt-text3">
                  <th className="px-3 py-2 font-medium">Producto</th>
                  <th className="px-3 py-2 font-medium">Cant.</th>
                  <th className="px-3 py-2 font-medium">Costo Unit.</th>
                  <th className="px-3 py-2 font-medium">Subtotal</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((l) => (
                  <tr key={l.producto_id} className="border-b border-vt-border last:border-0">
                    <td className="px-3 py-2 text-neutral-900 dark:text-white">{l.nombre}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0.01}
                        step="0.01"
                        value={l.cantidad}
                        onChange={(e) => actualizar(l.producto_id, "cantidad", Number(e.target.value) || 0)}
                        className="w-16 rounded-md border border-vt-border bg-vt-bg px-1.5 py-1 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={l.precio_unitario}
                        onChange={(e) => actualizar(l.producto_id, "precio_unitario", Number(e.target.value) || 0)}
                        className="w-20 rounded-md border border-vt-border bg-vt-bg px-1.5 py-1 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2 font-mono font-semibold">
                      {formatMoney(centavos(l.cantidad * l.precio_unitario))}
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => quitar(l.producto_id)} className="text-vt-text3 hover:text-vt-red">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lineas.length === 0 && (
              <div className="py-6 text-center text-sm text-vt-text3">
                Agrega productos usando el buscador
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-vt-text3">{lineas.length} productos</span>
            <span className="font-head text-lg font-extrabold text-vt-blue">
              Total: {formatMoney(total)}
            </span>
          </div>

          {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-vt-border px-6 py-4">
          <button onClick={onClose} className="rounded-xl border border-vt-border px-4 py-2 text-sm font-medium text-vt-text2 hover:bg-vt-card-hover">
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={pending}
            className="rounded-xl bg-vt-blue px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Guardando…" : "Registrar Entrada"}
          </button>
        </div>
      </div>
    </div>
  );
}
