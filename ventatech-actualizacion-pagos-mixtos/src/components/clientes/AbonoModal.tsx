"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Coins } from "lucide-react";
import { registrarAbonoAction } from "@/app/actions/clientes-actions";
import { formatMoney } from "@/lib/money";

const METODOS = ["efectivo", "tarjeta", "transferencia"];

export function AbonoModal({
  deudaId,
  clienteNombre,
  saldo,
  onClose,
  onDone,
}: {
  deudaId: string;
  clienteNombre: string;
  saldo: number;
  onClose: () => void;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [monto, setMonto] = useState(String(saldo));
  const [metodo, setMetodo] = useState("efectivo");
  const [notas, setNotas] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirmar() {
    // A centavos: "100.555" se guardaba con decimales de más y no cuadraba.
    const m = Math.round(Number(monto) * 100) / 100;
    if (!Number.isFinite(m) || m <= 0) return setError("Monto inválido");
    if (m > Math.round(saldo * 100) / 100) return setError(`El monto supera el saldo (${formatMoney(saldo)})`);
    startTransition(async () => {
      const res = await registrarAbonoAction({ deudaId, monto: m, metodoPago: metodo, notas });
      if (res.error) return setError(res.error);
      router.refresh();
      onDone?.();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-vt-card" style={{ boxShadow: "var(--shadow-vt-lg)" }}>
        <div className="flex items-center justify-between border-b border-vt-border px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-neutral-900 dark:text-white">
            <Coins className="h-5 w-5 text-vt-green" />
            Registrar Abono
          </h2>
          <button onClick={onClose} className="text-vt-text3 hover:text-neutral-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-3 px-6 py-5">
          <div>
            <div className="text-sm font-semibold text-neutral-900 dark:text-white">{clienteNombre}</div>
            <div className="text-xs text-vt-text3">Saldo pendiente: {formatMoney(saldo)}</div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-vt-text3">Monto</label>
            <input
              autoFocus
              type="number"
              min={0.01}
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="w-full rounded-xl border border-vt-border bg-vt-bg px-3.5 py-2.5 text-sm outline-none focus:border-vt-blue"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-vt-text3">Método de pago</label>
            <div className="grid grid-cols-3 gap-2">
              {METODOS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMetodo(m)}
                  className={`rounded-xl border py-2 text-xs font-semibold capitalize transition ${
                    metodo === m
                      ? "border-vt-blue bg-vt-blue/10 text-vt-blue"
                      : "border-vt-border text-vt-text2 hover:bg-vt-card-hover"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-vt-text3">
              Notas (opcional)
            </label>
            <input
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="w-full rounded-xl border border-vt-border bg-vt-bg px-3.5 py-2.5 text-sm outline-none focus:border-vt-blue"
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-vt-border px-6 py-4">
          <button onClick={onClose} className="rounded-xl border border-vt-border px-4 py-2 text-sm font-medium text-vt-text2 hover:bg-vt-card-hover">
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={pending}
            className="rounded-xl bg-vt-green px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Guardando…" : "✓ Registrar Abono"}
          </button>
        </div>
      </div>
    </div>
  );
}
