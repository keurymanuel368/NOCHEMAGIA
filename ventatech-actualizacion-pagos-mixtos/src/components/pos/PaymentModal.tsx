"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Banknote, CreditCard, ArrowLeftRight, HandCoins, X, Check, FileText, Layers } from "lucide-react";
import type { MetodoPago } from "@/lib/pos/types";
import { centavos, type PagoParte, type TipoTarjeta } from "@/lib/pagos";
import { TIPO_NCF_LABEL, type TipoNCF } from "@/lib/fiscal/types";
import { formatMoney } from "@/lib/money";
import { useToast } from "@/components/ui/ToastProvider";

const METODOS: { id: MetodoPago; label: string; icon: typeof Banknote }[] = [
  { id: "efectivo", label: "Efectivo", icon: Banknote },
  { id: "tarjeta", label: "Tarjeta", icon: CreditCard },
  { id: "transferencia", label: "Transf.", icon: ArrowLeftRight },
  { id: "fiado", label: "Fiado", icon: HandCoins },
  { id: "mixto", label: "Mixto", icon: Layers },
];

export type PagoSeleccionado = {
  metodo: MetodoPago;
  /** Tarjeta (sola o en pago mixto): débito o crédito. */
  tipoTarjeta?: TipoTarjeta | null;
  /** Pago mixto: cuánto se paga con cada método. Siempre suma el total. */
  pagos?: PagoParte[];
  /** Efectivo que entregó el cliente, para calcular el cambio. */
  montoRecibido?: number;
};

function SelectorTipoTarjeta({
  valor,
  onChange,
}: {
  valor: TipoTarjeta | null;
  onChange: (t: TipoTarjeta) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(["debito", "credito"] as const).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={`rounded-xl border py-2 text-sm font-semibold transition ${
            valor === t
              ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
              : "border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-white/10 dark:text-neutral-300 dark:hover:bg-white/5"
          }`}
        >
          {t === "debito" ? "Débito" : "Crédito"}
        </button>
      ))}
    </div>
  );
}

const INPUT_MONTO =
  "w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-right font-mono text-base font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-[#0b1424] dark:text-white";

const DENOMINACIONES = [50, 100, 200, 500, 1000, 2000];

function billetesSugeridos(total: number): number[] {
  const mayores = DENOMINACIONES.filter((d) => d > total);
  if (mayores.length >= 3) return mayores.slice(0, 3);

  const extra: number[] = [];
  let siguiente = Math.ceil((total + 1) / 1000) * 1000;
  while (mayores.length + extra.length < 3) {
    extra.push(siguiente);
    siguiente += 1000;
  }
  return [...mayores, ...extra];
}

export function PaymentModal({
  total,
  requiereCliente,
  tiposNcfDisponibles,
  onClose,
  onConfirmar,
}: {
  total: number;
  requiereCliente: boolean;
  tiposNcfDisponibles: TipoNCF[];
  onClose: () => void;
  onConfirmar: (
    pago: PagoSeleccionado,
    ncfTipo?: TipoNCF | null
  ) => Promise<{ error?: string; offline?: boolean; aviso?: string }>;
}) {
  const [metodo, setMetodo] = useState<MetodoPago>("efectivo");
  const [montoRecibido, setMontoRecibido] = useState("");
  const [tipoTarjeta, setTipoTarjeta] = useState<TipoTarjeta | null>(null);
  const [mixtoTarjeta, setMixtoTarjeta] = useState("");
  const [mixtoTransferencia, setMixtoTransferencia] = useState("");
  const [ncfTipo, setNcfTipo] = useState<TipoNCF | "">("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const enviando = useRef(false);
  const toast = useToast();

  const recibido = Number(montoRecibido) || 0;
  const sugeridos = useMemo(() => billetesSugeridos(total), [total]);

  // Pago mixto: el cajero pone lo de tarjeta y/o transferencia; el resto es
  // efectivo.
  const montoTarjeta = centavos(Number(mixtoTarjeta) || 0);
  const montoTransferencia = centavos(Number(mixtoTransferencia) || 0);
  const efectivoMixto = centavos(total - montoTarjeta - montoTransferencia);
  const partesMixto: PagoParte[] = [
    ...(efectivoMixto > 0 ? [{ metodo: "efectivo" as const, monto: efectivoMixto }] : []),
    ...(montoTarjeta > 0 ? [{ metodo: "tarjeta" as const, tipoTarjeta, monto: montoTarjeta }] : []),
    ...(montoTransferencia > 0 ? [{ metodo: "transferencia" as const, monto: montoTransferencia }] : []),
  ];

  // Efectivo que entra a la gaveta: todo el total (efectivo) o el resto (mixto).
  const efectivoACobrar =
    metodo === "efectivo" ? total : metodo === "mixto" ? Math.max(efectivoMixto, 0) : 0;
  const cambio = recibido - efectivoACobrar;
  const faltaEfectivo = metodo === "efectivo" && recibido < total;
  // En mixto el efectivo recibido es opcional: si se deja vacío, se asume exacto.
  const faltaEfectivoMixto = metodo === "mixto" && montoRecibido !== "" && recibido < efectivoACobrar;

  function errorMixto(): string | null {
    if (efectivoMixto < 0) return "Tarjeta + transferencia no pueden pasar del total";
    if (partesMixto.length < 2) return "Pon el monto de al menos dos métodos (el resto se cobra en efectivo)";
    if (montoTarjeta > 0 && !tipoTarjeta) return "Indica si la tarjeta es de débito o de crédito";
    if (faltaEfectivoMixto) return "El efectivo recibido es menor a la parte en efectivo";
    return null;
  }

  function cambiarMetodo(id: MetodoPago) {
    setMetodo(id);
    setMontoRecibido("");
    setError(null);
  }

  function confirmar() {
    // Doble clic o Enter repetido: el segundo se ignora mientras el primero sigue.
    if (enviando.current || pending) return;
    if (metodo === "fiado" && requiereCliente) {
      setError("Selecciona un cliente para venta a fiado");
      return;
    }
    if (faltaEfectivo) {
      setError("El monto recibido es menor al total");
      return;
    }
    if (metodo === "tarjeta" && !tipoTarjeta) {
      setError("Indica si la tarjeta es de débito o de crédito");
      return;
    }
    if (metodo === "mixto") {
      const e = errorMixto();
      if (e) {
        setError(e);
        return;
      }
    }
    setError(null);

    let pago: PagoSeleccionado;
    if (metodo === "efectivo") {
      pago = { metodo, montoRecibido: recibido };
    } else if (metodo === "tarjeta") {
      pago = { metodo, tipoTarjeta };
    } else if (metodo === "mixto") {
      pago = {
        metodo,
        pagos: partesMixto,
        montoRecibido:
          efectivoMixto > 0 ? (montoRecibido === "" ? efectivoMixto : recibido) : undefined,
      };
    } else {
      pago = { metodo };
    }

    enviando.current = true;
    startTransition(async () => {
      const res = await onConfirmar(pago, ncfTipo || null).finally(() => {
        enviando.current = false;
      });
      if (res.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success(
        res.offline
          ? "Venta guardada sin conexión: se sincronizará automáticamente"
          : "Venta registrada correctamente"
      );
      if (res.aviso) toast.error(res.aviso);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[95vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-[#0f1b33]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900 dark:text-white">
            💰 Confirmar Cobro
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 text-center">
          <div className="text-xs uppercase tracking-wide text-neutral-400">Total a cobrar</div>
          <div className="text-3xl font-extrabold text-green-600 dark:text-green-400">
            {formatMoney(total)}
          </div>
        </div>

        <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Método de pago
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {METODOS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => cambiarMetodo(id)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border px-1 py-3 text-xs font-medium transition ${
                metodo === id
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                  : "border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-white/10 dark:text-neutral-300 dark:hover:bg-white/5"
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </div>

        {metodo === "tarjeta" && (
          <div className="mt-4">
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Tipo de tarjeta
            </div>
            <SelectorTipoTarjeta valor={tipoTarjeta} onChange={setTipoTarjeta} />
          </div>
        )}

        {metodo === "mixto" && (
          <div className="mt-4 flex flex-col gap-2.5">
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              ¿Cuánto paga con cada método?
            </div>

            <div className="rounded-xl border border-neutral-200 p-2.5 dark:border-white/10">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-neutral-700 dark:text-neutral-200">
                  <CreditCard className="h-4 w-4" /> Tarjeta
                </span>
                <button
                  type="button"
                  onClick={() => setMixtoTarjeta(String(Math.max(centavos(total - montoTransferencia), 0)))}
                  className="text-[11px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  Poner el resto
                </button>
              </div>
              <input
                autoFocus
                type="number"
                min={0}
                step="0.01"
                value={mixtoTarjeta}
                onChange={(e) => setMixtoTarjeta(e.target.value)}
                placeholder="0.00"
                className={INPUT_MONTO}
              />
              {montoTarjeta > 0 && (
                <div className="mt-2">
                  <SelectorTipoTarjeta valor={tipoTarjeta} onChange={setTipoTarjeta} />
                </div>
              )}
            </div>

            <div className="rounded-xl border border-neutral-200 p-2.5 dark:border-white/10">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-neutral-700 dark:text-neutral-200">
                  <ArrowLeftRight className="h-4 w-4" /> Transferencia
                </span>
                <button
                  type="button"
                  onClick={() => setMixtoTransferencia(String(Math.max(centavos(total - montoTarjeta), 0)))}
                  className="text-[11px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  Poner el resto
                </button>
              </div>
              <input
                type="number"
                min={0}
                step="0.01"
                value={mixtoTransferencia}
                onChange={(e) => setMixtoTransferencia(e.target.value)}
                placeholder="0.00"
                className={INPUT_MONTO}
              />
            </div>

            <div
              className={`flex items-center justify-between rounded-xl px-4 py-2.5 ${
                efectivoMixto < 0 ? "bg-red-50 dark:bg-red-500/10" : "bg-neutral-100 dark:bg-white/5"
              }`}
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold text-neutral-700 dark:text-neutral-200">
                <Banknote className="h-4 w-4" /> Efectivo (el resto)
              </span>
              <span
                className={`font-mono text-lg font-extrabold ${
                  efectivoMixto < 0 ? "text-red-700 dark:text-red-400" : "text-neutral-900 dark:text-white"
                }`}
              >
                {formatMoney(efectivoMixto)}
              </span>
            </div>

            {efectivoMixto > 0 && (
              <>
                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  Efectivo recibido (opcional, para el cambio)
                </div>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={montoRecibido}
                  onChange={(e) => setMontoRecibido(e.target.value)}
                  placeholder={efectivoMixto.toFixed(2)}
                  className={INPUT_MONTO}
                />
                {montoRecibido !== "" && (
                  <div
                    className={`flex items-center justify-between rounded-xl px-4 py-2.5 ${
                      cambio < 0 ? "bg-red-50 dark:bg-red-500/10" : "bg-green-50 dark:bg-green-500/10"
                    }`}
                  >
                    <span
                      className={`text-sm font-semibold ${
                        cambio < 0 ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400"
                      }`}
                    >
                      {cambio < 0 ? "FALTA" : "CAMBIO"}
                    </span>
                    <span
                      className={`text-lg font-extrabold ${
                        cambio < 0 ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400"
                      }`}
                    >
                      {formatMoney(Math.abs(cambio))}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {metodo === "efectivo" && (
          <>
            <div className="mb-1.5 mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Monto recibido
            </div>
            <input
              autoFocus
              type="number"
              min={0}
              step="0.01"
              value={montoRecibido}
              onChange={(e) => setMontoRecibido(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-center text-2xl font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-[#0b1424] dark:text-white"
            />

            <div className="mt-2 grid grid-cols-4 gap-2">
              <button
                onClick={() => setMontoRecibido(String(total))}
                className="rounded-xl border border-neutral-200 py-2 text-center text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 dark:border-white/10 dark:text-neutral-200 dark:hover:bg-white/5"
              >
                {formatMoney(total)}
                <div className="font-normal text-neutral-400">exacto</div>
              </button>
              {sugeridos.map((b) => (
                <button
                  key={b}
                  onClick={() => setMontoRecibido(String(b))}
                  className="rounded-xl border border-neutral-200 py-2 text-center text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 dark:border-white/10 dark:text-neutral-200 dark:hover:bg-white/5"
                >
                  {formatMoney(b)}
                  <div className="font-normal text-neutral-400">billete</div>
                </button>
              ))}
            </div>

            <div
              className={`mt-3 flex items-center justify-between rounded-xl px-4 py-3 ${
                cambio < 0
                  ? "bg-red-50 dark:bg-red-500/10"
                  : "bg-green-50 dark:bg-green-500/10"
              }`}
            >
              <span
                className={`text-sm font-semibold ${
                  cambio < 0 ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400"
                }`}
              >
                {cambio < 0 ? "FALTA" : "CAMBIO"}
              </span>
              <span
                className={`text-xl font-extrabold ${
                  cambio < 0 ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400"
                }`}
              >
                {formatMoney(Math.abs(cambio))}
              </span>
            </div>
          </>
        )}

        {tiposNcfDisponibles.length > 0 && (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              <FileText className="h-3.5 w-3.5" />
              Comprobante fiscal (opcional)
            </div>
            <select
              value={ncfTipo}
              onChange={(e) => setNcfTipo(e.target.value as TipoNCF | "")}
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 dark:border-white/10 dark:bg-[#0b1424] dark:text-white"
            >
              <option value="">Sin comprobante fiscal</option>
              {tiposNcfDisponibles.map((t) => (
                <option key={t} value={t}>
                  {t} — {TIPO_NCF_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          onClick={confirmar}
          disabled={pending || faltaEfectivo}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
        >
          <Check className="h-4 w-4" />
          {pending ? "Procesando…" : "Confirmar cobro"}
        </button>
      </div>
    </div>
  );
}
