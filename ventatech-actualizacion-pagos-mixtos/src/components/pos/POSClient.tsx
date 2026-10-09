"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet, ShoppingCart, ShoppingBag, ClipboardList, PauseCircle } from "lucide-react";
import type { UsuarioProfile } from "@/lib/auth";
import type { Cliente, Producto, CartLine } from "@/lib/pos/types";
import { lineasPago, textoMetodoPago, type PagoParte } from "@/lib/pagos";
import type { CajaSesion } from "@/lib/caja/queries";
import type { CajaAbiertaPOS } from "@/lib/pos/queries";
import { precioEfectivo, esUnidadEntera } from "@/lib/pos/types";
import type { TipoNCF } from "@/lib/fiscal/types";
import {
  registrarVentaAction,
  obtenerCuadreCajaAction,
  aparcarVentaAction,
  listarVentasAparcadasAction,
  eliminarVentaAparcadaAction,
  type ItemVentaInput,
  type VentaAparcada,
} from "@/app/actions/pos-actions";
import { aplicarCuponAction, type CuponAplicado } from "@/app/actions/cupones-actions";
import { formatMoney } from "@/lib/money";
import { imprimirFactura } from "@/lib/pos/print";
import { useOfflineSync } from "@/lib/offline/useOfflineSync";
import { useActualizacionEnVivo } from "@/lib/tiempo-real/useActualizacionEnVivo";
import { encolarVentaPendiente } from "@/lib/offline/db";
import { useNegocio } from "@/components/providers/NegocioProvider";
import { useToast } from "@/components/ui/ToastProvider";
import { SoporteBanner } from "@/components/layout/SoporteBanner";
import { RespaldoAutomaticoGlobal } from "@/components/layout/RespaldoAutomaticoGlobal";
import { OfflineBanner } from "./OfflineBanner";

import { POSTopBar } from "./POSTopBar";
import { ProductGrid } from "./ProductGrid";
import { CustomerPicker } from "./CustomerPicker";
import { CartPanel } from "./CartPanel";
import { CheckoutSummaryBar } from "./CheckoutSummaryBar";
import { CajaModal } from "./CajaModal";
import { PaymentModal, type PagoSeleccionado } from "./PaymentModal";
import { QuickSaleModal } from "./QuickSaleModal";
import { PrinterConfigModal } from "./PrinterConfigModal";
import { AparcarVentaModal } from "./AparcarVentaModal";
import { VentasAparcadasModal } from "./VentasAparcadasModal";
import { HistorialTab } from "./HistorialTab";

type CajaInfo = CajaAbiertaPOS;

export function POSClient({
  usuario,
  productosIniciales,
  clientesIniciales,
  cajaInicial,
  tiposNcfDisponibles,
  ventasAparcadasIniciales,
}: {
  usuario: UsuarioProfile;
  productosIniciales: Producto[];
  clientesIniciales: Cliente[];
  cajaInicial: CajaInfo;
  tiposNcfDisponibles: TipoNCF[];
  ventasAparcadasIniciales: VentaAparcada[];
}) {
  const router = useRouter();
  const toast = useToast();
  const { nombre: negocioNombre } = useNegocio();

  const {
    productos,
    clientes,
    pendientes,
    enLinea,
    sincronizando,
    sincronizar,
    registrarVentaOffline,
  } = useOfflineSync(productosIniciales, clientesIniciales);

  // Productos nuevos o con stock cambiado desde otra PC aparecen solos.
  useActualizacionEnVivo({ tabla: "productos", intervaloMs: 30_000 });

  const [carrito, setCarrito] = useState<CartLine[]>([]);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [descuento, setDescuento] = useState(0);
  const [cuponAplicado, setCuponAplicado] = useState<CuponAplicado | null>(null);
  const [autoAdd] = useState(true);

  const [cajaModal, setCajaModal] = useState<"abrir" | "cerrar" | null>(null);
  const [pagoAbierto, setPagoAbierto] = useState(false);
  const [ventaRapidaAbierta, setVentaRapidaAbierta] = useState(false);
  const [impresoraAbierta, setImpresoraAbierta] = useState(false);
  const [ultimaVenta, setUltimaVenta] = useState<string | null>(null);
  const [tab, setTab] = useState<"venta" | "historial">("venta");
  const [ventasAparcadas, setVentasAparcadas] = useState(ventasAparcadasIniciales);
  const [aparcandoAbierto, setAparcandoAbierto] = useState(false);
  const [verAparcadasAbierto, setVerAparcadasAbierto] = useState(false);

  const cajaAbierta = Boolean(cajaInicial);

  const subtotal = useMemo(
    () => carrito.reduce((s, i) => s + i.precio * i.cantidad, 0),
    [carrito]
  );
  const cuponDescuento = useMemo(() => {
    if (!cuponAplicado) return 0;
    const calculado =
      cuponAplicado.tipo === "porcentaje"
        ? Math.round(((subtotal * cuponAplicado.valor) / 100) * 100) / 100
        : cuponAplicado.valor;
    return Math.min(calculado, subtotal);
  }, [cuponAplicado, subtotal]);
  const descuentoTotal = descuento + cuponDescuento;
  const total = Math.max(subtotal - descuentoTotal, 0);

  async function aplicarCupon(codigo: string): Promise<string | null> {
    const res = await aplicarCuponAction(codigo, subtotal);
    if (res.error || !res.cupon) return res.error ?? "No se pudo aplicar el cupón";
    setCuponAplicado(res.cupon);
    return null;
  }

  function quitarCupon() {
    setCuponAplicado(null);
  }

  const agregarProducto = useCallback((p: Producto) => {
    setUltimaVenta(null);
    setCarrito((prev) => {
      const existente = prev.find((i) => i.producto_id === p.id);
      if (existente) {
        if (existente.cantidad >= p.stock) return prev;
        const nuevaCantidad = existente.cantidad + 1;
        return prev.map((i) =>
          i.producto_id === p.id
            ? {
                ...i,
                cantidad: nuevaCantidad,
                precio: precioEfectivo(i.precioNormal, i.precioMayoreo, i.cantidadMayoreo, nuevaCantidad),
              }
            : i
        );
      }
      return [
        ...prev,
        {
          key: p.id,
          producto_id: p.id,
          nombre: p.nombre,
          precio: precioEfectivo(p.precio, p.precioMayoreo, p.cantidadMayoreo, 1),
          precioNormal: p.precio,
          precioMayoreo: p.precioMayoreo,
          cantidadMayoreo: p.cantidadMayoreo,
          cantidad: 1,
          unidad: p.unidad,
          stockDisponible: p.stock,
        },
      ];
    });
  }, []);

  function agregarVentaRapida(nombre: string, precio: number, cantidad: number) {
    setUltimaVenta(null);
    setCarrito((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        producto_id: null,
        nombre,
        precio,
        precioNormal: precio,
        precioMayoreo: null,
        cantidadMayoreo: null,
        cantidad,
        unidad: "unidad",
        stockDisponible: null,
      },
    ]);
  }

  // Por peso/volumen (libra, kg, litro, etc.) se admiten cantidades
  // fraccionarias; una "unidad" siempre es una pieza entera, mínimo 1.
  function actualizarCantidad(key: string, valorTexto: string) {
    setCarrito((prev) =>
      prev.map((i) => {
        if (i.key !== key) return i;
        let cantidad = Number(valorTexto);
        if (Number.isNaN(cantidad)) return i;

        if (esUnidadEntera(i.unidad)) {
          cantidad = Math.round(cantidad);
        } else {
          cantidad = Math.round(cantidad * 1000) / 1000;
        }
        const minimo = esUnidadEntera(i.unidad) ? 1 : 0.001;
        cantidad = Math.max(minimo, cantidad);
        if (i.stockDisponible !== null) cantidad = Math.min(cantidad, i.stockDisponible);

        return {
          ...i,
          cantidad,
          precio: precioEfectivo(i.precioNormal, i.precioMayoreo, i.cantidadMayoreo, cantidad),
        };
      })
    );
  }

  function incrementar(key: string) {
    setCarrito((prev) =>
      prev.map((i) => {
        if (i.key !== key) return i;
        if (i.stockDisponible !== null && i.cantidad >= i.stockDisponible) return i;
        const nuevaCantidad = i.cantidad + 1;
        return {
          ...i,
          cantidad: nuevaCantidad,
          precio: precioEfectivo(i.precioNormal, i.precioMayoreo, i.cantidadMayoreo, nuevaCantidad),
        };
      })
    );
  }

  function decrementar(key: string) {
    setCarrito((prev) =>
      prev
        .map((i) => {
          if (i.key !== key) return i;
          const nuevaCantidad = i.cantidad - 1;
          return {
            ...i,
            cantidad: nuevaCantidad,
            precio: precioEfectivo(i.precioNormal, i.precioMayoreo, i.cantidadMayoreo, nuevaCantidad),
          };
        })
        .filter((i) => i.cantidad > 0)
    );
  }

  function quitar(key: string) {
    setCarrito((prev) => prev.filter((i) => i.key !== key));
  }

  // Un solo id por cobro: si el cajero vuelve a intentar el MISMO carrito
  // (doble clic, respuesta lenta, error de red), se manda el mismo id y el
  // servidor devuelve la venta ya creada en vez de cobrarla otra vez. Se
  // renueva solo cuando cambia el carrito o se termina la venta.
  const idCobro = useRef<string | null>(null);
  const cobrando = useRef(false);
  useEffect(() => {
    idCobro.current = null;
  }, [carrito, cliente, descuento, cuponAplicado]);

  // El cuadre para cerrar caja se calcula en el momento (no en cada recarga).
  const [cuadreCierre, setCuadreCierre] = useState<CajaSesion | null>(null);
  async function abrirModalCaja() {
    if (!cajaAbierta) {
      setCajaModal("abrir");
      return;
    }
    try {
      const cuadre = await obtenerCuadreCajaAction();
      if (!cuadre) {
        toast.error("No se encontró la caja abierta");
        router.refresh();
        return;
      }
      setCuadreCierre(cuadre);
      setCajaModal("cerrar");
    } catch {
      toast.error("No se pudo calcular el cuadre de caja. Revisa la conexión.");
    }
  }

  function limpiarCarrito() {
    idCobro.current = null;
    setCarrito([]);
    setDescuento(0);
    setCuponAplicado(null);
    setCliente(null);
  }

  // Aparcar: guarda el carrito tal cual en el servidor (visible para
  // cualquier caja de la empresa) y libera la pantalla para otra venta.
  async function aparcarVenta(nota: string) {
    const res = await aparcarVentaAction({
      cajeroNombre: usuario.nombre,
      clienteId: cliente?.id ?? null,
      clienteNombre: cliente?.nombre ?? null,
      nota,
      items: carrito,
      descuento: descuentoTotal,
      subtotal,
    });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    const frescas = await listarVentasAparcadasAction();
    setVentasAparcadas(frescas);
    limpiarCarrito();
    setAparcandoAbierto(false);
    toast.success("Venta aparcada");
  }

  // Retomar: reconstruye el carrito usando precios/stock actuales (pueden
  // haber cambiado desde que se aparcó); si un producto ya no existe o está
  // inactivo, se omite en vez de fallar toda la venta.
  //
  // Primero se borra la venta aparcada y solo si el borrado tuvo éxito se
  // carga el carrito: si dos cajeros la retoman casi al mismo tiempo, solo
  // el primero en borrarla la consigue, evitando cobrarla dos veces.
  async function retomarVenta(v: VentaAparcada) {
    if (carrito.length > 0 && !confirm("Ya tienes una venta en curso. ¿Reemplazarla con la venta aparcada?")) {
      return;
    }

    const eliminado = await eliminarVentaAparcadaAction(v.id);
    if (eliminado.error) {
      toast.error(eliminado.error);
      setVentasAparcadas(await listarVentasAparcadasAction());
      return;
    }
    setVentasAparcadas((prev) => prev.filter((x) => x.id !== v.id));

    const nuevoCarrito: CartLine[] = [];
    let omitidos = 0;
    for (const item of v.items) {
      if (item.producto_id) {
        const p = productos.find((pr) => pr.id === item.producto_id);
        const cantidad = p ? Math.min(item.cantidad, p.stock) : 0;
        if (!p || cantidad <= 0) {
          omitidos++;
          continue;
        }
        nuevoCarrito.push({
          key: p.id,
          producto_id: p.id,
          nombre: p.nombre,
          precio: precioEfectivo(p.precio, p.precioMayoreo, p.cantidadMayoreo, cantidad),
          precioNormal: p.precio,
          precioMayoreo: p.precioMayoreo,
          cantidadMayoreo: p.cantidadMayoreo,
          cantidad,
          unidad: p.unidad,
          stockDisponible: p.stock,
        });
      } else {
        nuevoCarrito.push(item);
      }
    }

    setCarrito(nuevoCarrito);
    setDescuento(v.descuento);
    setCuponAplicado(null);
    setCliente(v.clienteId ? clientes.find((c) => c.id === v.clienteId) ?? null : null);
    setUltimaVenta(null);
    setVerAparcadasAbierto(false);

    if (omitidos > 0) {
      toast.error(`Venta retomada: ${omitidos} producto(s) ya no disponibles se omitieron`);
    } else {
      toast.success("Venta retomada");
    }
  }

  async function eliminarAparcada(id: string) {
    const res = await eliminarVentaAparcadaAction(id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setVentasAparcadas((prev) => prev.filter((v) => v.id !== id));
  }

  async function confirmarPago(pago: PagoSeleccionado, ncfTipo?: TipoNCF | null) {
    // Mientras una venta se está procesando no se acepta otra.
    if (cobrando.current) return { error: "La venta ya se está procesando, espera un momento" };
    cobrando.current = true;
    try {
      return await procesarPago(pago, ncfTipo);
    } finally {
      cobrando.current = false;
    }
  }

  async function procesarPago(pago: PagoSeleccionado, ncfTipo?: TipoNCF | null) {
    const metodo = pago.metodo;
    const montoRecibido = pago.montoRecibido;
    // Un solo id por intento de cobro: si la venta llega a completarse en el
    // servidor pero la respuesta se pierde (wifi inestable), el reintento
    // offline usa el mismo id y el servidor devuelve la venta ya creada en
    // vez de duplicarla.
    if (!idCobro.current) idCobro.current = crypto.randomUUID();
    const ventaLocalId = idCobro.current;
    const items: ItemVentaInput[] = carrito.map((i) => ({
      producto_id: i.producto_id,
      nombre: i.producto_id ? undefined : i.nombre,
      precio: i.producto_id ? undefined : i.precio,
      cantidad: i.cantidad,
    }));
    const clienteNombre = cliente?.nombre ?? "Cliente general";

    function imprimir(
      numeroFactura: string,
      fecha: string,
      ncf?: string | null,
      confirmado?: {
        subtotal: number;
        descuento: number;
        total: number;
        items: { nombre: string; cantidad: number; subtotal: number }[];
        pagos?: PagoParte[];
      }
    ) {
      // Si el servidor confirmó los montos finales (pueden diferir de lo que
      // tenía el cajero en pantalla si un precio cambió justo antes de
      // cobrar), el ticket se imprime con esos valores, no con el carrito
      // local. En modo offline no hay confirmación todavía: se usa el
      // carrito local y ya, sin retrasar la venta ni pedir nada al cajero.
      // Partes del pago (tarjeta débito/crédito o mixto) tal como quedaron.
      const partes: PagoParte[] | undefined =
        confirmado?.pagos ??
        (metodo === "mixto"
          ? pago.pagos
          : metodo === "tarjeta"
            ? [{ metodo: "tarjeta", tipoTarjeta: pago.tipoTarjeta ?? null, monto: confirmado?.total ?? total }]
            : undefined);
      const efectivoACobrar =
        metodo === "efectivo"
          ? confirmado?.total ?? total
          : (partes ?? []).filter((p) => p.metodo === "efectivo").reduce((s, p) => s + p.monto, 0);
      const conEfectivo = (metodo === "efectivo" || metodo === "mixto") && montoRecibido !== undefined;
      const cambioImpreso = conEfectivo ? Math.max(montoRecibido - efectivoACobrar, 0) : undefined;
      imprimirFactura({
        negocioNombre,
        numeroFactura,
        ncf: ncf ?? undefined,
        fecha,
        cajero: usuario.nombre,
        cliente: clienteNombre,
        metodoPago: textoMetodoPago(
          metodo,
          partes?.map((p) => ({ metodo: p.metodo, tipo_tarjeta: p.tipoTarjeta ?? null, monto: p.monto }))
        ),
        pagos: metodo === "mixto" && partes ? lineasPago(partes) : undefined,
        items:
          confirmado?.items ??
          carrito.map((i) => ({
            nombre: i.nombre,
            cantidad: i.cantidad,
            subtotal: i.precio * i.cantidad,
          })),
        subtotal: confirmado?.subtotal ?? subtotal,
        descuento: confirmado?.descuento ?? descuentoTotal,
        total: confirmado?.total ?? total,
        montoRecibido: conEfectivo ? montoRecibido : undefined,
        cambio: cambioImpreso,
      }).catch(() => {});
    }

    async function guardarOffline() {
      const localId = ventaLocalId;
      const fecha = new Date().toISOString();
      await encolarVentaPendiente({
        localId,
        fecha,
        items,
        clienteId: cliente?.id ?? null,
        clienteNombre,
        metodoPago: metodo,
        tipoTarjeta: pago.tipoTarjeta ?? null,
        pagos: pago.pagos,
        descuento: descuentoTotal,
        subtotal,
        total,
        montoRecibido,
        cajeroNombre: usuario.nombre,
      });
      await registrarVentaOffline(
        carrito
          .filter((i) => i.producto_id)
          .map((i) => ({ productoId: i.producto_id as string, cantidad: i.cantidad }))
      );
      imprimir(`OFFLINE-${localId.slice(0, 8).toUpperCase()}`, fecha);
      setUltimaVenta(localId);
      limpiarCarrito();
      setPagoAbierto(false);
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await guardarOffline();
      return { offline: true };
    }

    try {
      const res = await registrarVentaAction({
        items,
        clienteId: cliente?.id ?? null,
        metodoPago: metodo,
        tipoTarjeta: pago.tipoTarjeta ?? null,
        pagos: pago.pagos,
        // Solo el descuento manual: si hay cupón, el servidor recalcula su
        // monto internamente en vez de confiar en lo que mande el navegador.
        descuento,
        ncfTipo,
        cuponId: cuponAplicado?.cuponId ?? null,
        localId: ventaLocalId,
      });

      if (res.error) return { error: res.error };

      if (res.numeroFactura && res.fecha) {
        imprimir(
          res.numeroFactura,
          res.fecha,
          res.ncf,
          res.subtotal !== undefined && res.descuento !== undefined && res.total !== undefined && res.items
            ? { subtotal: res.subtotal, descuento: res.descuento, total: res.total, items: res.items, pagos: res.pagos }
            : undefined
        );
      }

      setUltimaVenta(res.ventaId ?? null);
      limpiarCarrito();
      setPagoAbierto(false);
      router.refresh();
      return { aviso: res.avisoPagos };
    } catch {
      // El navegador decía "en línea" pero la petición no llegó (wifi sin
      // internet, red inestable, etc.): se cobra igual y se guarda para
      // sincronizar después, en vez de bloquear la venta.
      await guardarOffline();
      return { offline: true };
    }
  }

  return (
    <div className="flex h-screen flex-col bg-vt-bg">
      <SoporteBanner />
      <RespaldoAutomaticoGlobal />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:overflow-hidden">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <POSTopBar
          cajaAbierta={cajaAbierta}
          onCajaClick={abrirModalCaja}
          onPrinterClick={() => setImpresoraAbierta(true)}
        />

        <OfflineBanner
          enLinea={enLinea}
          pendientes={pendientes}
          sincronizando={sincronizando}
          onSincronizar={sincronizar}
        />

        <div className="flex border-b border-vt-border bg-vt-card">
          <button
            onClick={() => setTab("venta")}
            className={`flex flex-1 items-center justify-center gap-2 border-b-4 py-2.5 text-base font-bold transition ${
              tab === "venta"
                ? "border-vt-blue bg-vt-blue/10 text-vt-blue"
                : "border-transparent text-vt-text2 hover:text-neutral-900 dark:hover:text-white"
            }`}
          >
            <ShoppingBag className="h-4.5 w-4.5" />
            Nueva Venta
          </button>
          <button
            onClick={() => setTab("historial")}
            className={`flex flex-1 items-center justify-center gap-2 border-b-4 py-2.5 text-base font-bold transition ${
              tab === "historial"
                ? "border-vt-blue bg-vt-blue/10 text-vt-blue"
                : "border-transparent text-vt-text2 hover:text-neutral-900 dark:hover:text-white"
            }`}
          >
            <ClipboardList className="h-4.5 w-4.5" />
            Historial
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {tab === "venta" ? (
            <>
              <ProductGrid
                productos={productos}
                onAdd={agregarProducto}
                onOpenVentaRapida={() => setVentaRapidaAbierta(true)}
                autoAdd={autoAdd}
              />
              {carrito.length > 0 && (
                <CheckoutSummaryBar
                  subtotal={subtotal}
                  descuento={descuento}
                  onDescuentoChange={setDescuento}
                  cuponAplicado={cuponAplicado}
                  cuponDescuento={cuponDescuento}
                  onAplicarCupon={aplicarCupon}
                  onQuitarCupon={quitarCupon}
                  total={total}
                  itemCount={carrito.reduce((s, i) => s + i.cantidad, 0)}
                  onLimpiar={limpiarCarrito}
                />
              )}
            </>
          ) : (
            <HistorialTab />
          )}
        </div>
      </div>

      <div className="flex h-full w-full flex-1 flex-col border-t-2 border-vt-border bg-vt-card lg:flex-none lg:shrink-0 lg:w-[420px] lg:border-l-2 lg:border-t-0">
        <div className="flex items-center justify-between border-b border-vt-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-vt-blue/10">
              <Wallet className="h-4.5 w-4.5 text-vt-blue" />
            </div>
            <div>
              <h2 className="font-head text-lg font-extrabold tracking-tight text-neutral-900 dark:text-white">Cobro</h2>
              <p className="font-mono text-[11px] text-vt-text2">
                {carrito.length > 0 ? `${carrito.length} producto(s)` : "— sin venta activa —"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setVerAparcadasAbierto(true)}
              className="relative flex items-center gap-1.5 rounded-xl border border-vt-border px-3 py-2 text-xs font-semibold text-vt-text2 transition hover:bg-vt-card-hover"
              title="Ventas aparcadas"
            >
              <PauseCircle className="h-4 w-4 text-vt-amber" />
              Aparcadas
              {ventasAparcadas.length > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-vt-amber px-1 text-[10px] font-bold text-white">
                  {ventasAparcadas.length}
                </span>
              )}
            </button>
            <CustomerPicker
              clientes={clientes}
              seleccionado={cliente}
              onSeleccionar={setCliente}
            />
          </div>
        </div>

        <CartPanel
          carrito={carrito}
          onIncrementar={incrementar}
          onDecrementar={decrementar}
          onQuitar={quitar}
          onCambiarCantidad={actualizarCantidad}
        />

        {ultimaVenta && carrito.length === 0 && (
          <div className="mx-5 mb-3 rounded-lg bg-vt-green/10 px-3 py-2 text-xs font-medium text-vt-green">
            Venta registrada correctamente.
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-vt-border p-5">
          <button
            onClick={() => {
              if (!cajaAbierta) {
                setCajaModal("abrir");
                return;
              }
              if (carrito.length === 0) return;
              setPagoAbierto(true);
            }}
            disabled={carrito.length === 0 && cajaAbierta}
            className={`flex items-center justify-center gap-2 rounded-xl py-3 font-head text-[17px] font-extrabold text-white transition disabled:cursor-not-allowed disabled:opacity-45 ${
              cajaAbierta
                ? "bg-vt-green hover:-translate-y-0.5"
                : "bg-vt-amber hover:-translate-y-0.5"
            }`}
            style={{
              boxShadow: cajaAbierta
                ? "0 6px 24px rgba(0,200,83,.38)"
                : "0 6px 24px rgba(230,81,0,.30)",
            }}
          >
            {cajaAbierta ? (
              <>✓ Cobrar {formatMoney(total)}</>
            ) : (
              <>⚠ Abrir caja primero</>
            )}
          </button>
          <div className="flex gap-2">
            <button
              onClick={limpiarCarrito}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-vt-border py-2.5 text-sm font-medium text-vt-text2 transition hover:bg-vt-card-hover"
            >
              <ShoppingCart className="h-4 w-4" />
              Nueva venta
            </button>
            {carrito.length > 0 && (
              <button
                onClick={() => setAparcandoAbierto(true)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-vt-amber/40 bg-vt-amber/10 py-2.5 text-sm font-medium text-vt-amber transition hover:bg-vt-amber/20"
              >
                <PauseCircle className="h-4 w-4" />
                Aparcar venta
              </button>
            )}
          </div>
        </div>
      </div>

      {cajaModal && (
        <CajaModal
          mode={cajaModal}
          cuadre={
            cajaModal === "cerrar" && cuadreCierre
              ? {
                  montoInicial: cuadreCierre.monto_inicial,
                  cuadre: cuadreCierre.cuadre,
                  cajero: usuario.nombre,
                  abiertaAt: cuadreCierre.abierta_at,
                }
              : undefined
          }
          onClose={() => setCajaModal(null)}
          onDone={() => {
            setCajaModal(null);
            router.refresh();
          }}
        />
      )}

      {pagoAbierto && (
        <PaymentModal
          total={total}
          requiereCliente={cliente === null}
          tiposNcfDisponibles={tiposNcfDisponibles}
          onClose={() => setPagoAbierto(false)}
          onConfirmar={confirmarPago}
        />
      )}

      {ventaRapidaAbierta && (
        <QuickSaleModal
          onClose={() => setVentaRapidaAbierta(false)}
          onAdd={agregarVentaRapida}
        />
      )}

      {impresoraAbierta && <PrinterConfigModal onClose={() => setImpresoraAbierta(false)} />}

      {aparcandoAbierto && (
        <AparcarVentaModal onClose={() => setAparcandoAbierto(false)} onConfirmar={aparcarVenta} />
      )}

      {verAparcadasAbierto && (
        <VentasAparcadasModal
          ventas={ventasAparcadas}
          onClose={() => setVerAparcadasAbierto(false)}
          onRetomar={retomarVenta}
          onEliminar={eliminarAparcada}
        />
      )}
      </div>
    </div>
  );
}
