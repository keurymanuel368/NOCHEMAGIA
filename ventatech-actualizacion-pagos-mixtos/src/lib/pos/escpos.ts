// Impresión directa a una impresora térmica ESC/POS por WebUSB.
// Esto evita por completo el diálogo de impresión del navegador: los bytes
// se mandan directo al dispositivo, como en un POS de supermercado real.
"use client";

const STORAGE_KEY = "vt_printer_usb";

const ESC = 0x1b;
const GS = 0x1d;

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

// El ticket se armaba siempre para papel de 58mm (32 caracteres por línea),
// sin importar qué ancho tuviera realmente configurado el negocio (ej. una
// POS80 de 80mm/48 caracteres) — eso hacía que las líneas y separadores no
// llenaran el ancho real del papel y el ticket se viera descuadrado.
function anchoCaracteresPapel(): number {
  if (typeof localStorage === "undefined") return 32;
  return localStorage.getItem("vt_ancho_papel") === "80" ? 48 : 32;
}

function texto(s: string): Uint8Array {
  // La mayoría de impresoras térmicas de recibo usan CP437/Latin1; se
  // reemplazan acentos comunes para que no salgan símbolos raros.
  const normalizado = s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ñ/gi, (m) => (m === "ñ" ? "n" : "N"));
  return new TextEncoder().encode(normalizado);
}

export function construirTicketESCPOS(datos: {
  negocioNombre?: string;
  numeroFactura: string;
  ncf?: string;
  fecha: string;
  cajero: string;
  cliente: string;
  metodoPago: string;
  pagos?: { etiqueta: string; monto: number }[];
  items: { nombre: string; cantidad: number; subtotal: number }[];
  subtotal: number;
  descuento: number;
  total: number;
  montoRecibido?: number;
  cambio?: number;
  esCopia?: boolean;
  pagado?: number;
  saldoPendiente?: number;
  formatMoney: (n: number) => string;
}): Uint8Array {
  const ancho = anchoCaracteresPapel();
  const separador = "-".repeat(ancho) + "\n";
  const linea = (izq: string, der: string) => {
    const espacio = Math.max(1, ancho - izq.length - der.length);
    return izq + " ".repeat(espacio) + der + "\n";
  };

  const partes: Uint8Array[] = [
    new Uint8Array([ESC, 0x40]), // init
    new Uint8Array([ESC, 0x61, 1]), // centrar
    new Uint8Array([ESC, 0x45, 1]), // negrita on
    texto(`${datos.negocioNombre ?? "VentaTech"}\n`),
    new Uint8Array([ESC, 0x45, 0]), // negrita off
    texto(`Factura ${datos.numeroFactura}\n`),
    ...(datos.ncf ? [texto(`NCF: ${datos.ncf}\n`)] : []),
    texto(`${new Date(datos.fecha).toLocaleString("es-DO")}\n`),
    ...(datos.esCopia
      ? [
          new Uint8Array([ESC, 0x45, 1]),
          texto("*** COPIA ***\n"),
          new Uint8Array([ESC, 0x45, 0]),
          texto(`Reimpresa: ${new Date().toLocaleString("es-DO")}\n`),
        ]
      : []),
    new Uint8Array([ESC, 0x61, 0]), // alinear izquierda
    texto(separador),
    texto(`Cliente: ${datos.cliente}\n`),
    texto(`Cajero: ${datos.cajero}\n`),
    texto(separador),
  ];

  for (const it of datos.items) {
    partes.push(texto(`${it.nombre}\n`));
    partes.push(texto(linea(`  x${it.cantidad}`, datos.formatMoney(it.subtotal))));
  }

  partes.push(texto(separador));
  partes.push(texto(linea("Subtotal", datos.formatMoney(datos.subtotal))));
  if (datos.descuento > 0) {
    partes.push(texto(linea("Descuento", `-${datos.formatMoney(datos.descuento)}`)));
  }
  partes.push(new Uint8Array([ESC, 0x45, 1]));
  partes.push(texto(linea("TOTAL", datos.formatMoney(datos.total))));
  partes.push(new Uint8Array([ESC, 0x45, 0]));
  partes.push(texto(linea("Metodo", datos.metodoPago)));
  for (const p of datos.pagos ?? []) {
    partes.push(texto(linea(`  ${p.etiqueta}`, datos.formatMoney(p.monto))));
  }
  if (datos.montoRecibido !== undefined) {
    partes.push(texto(linea("Recibido", datos.formatMoney(datos.montoRecibido))));
  }
  if (datos.cambio !== undefined) {
    partes.push(texto(linea("Cambio", datos.formatMoney(datos.cambio))));
  }
  if (datos.pagado !== undefined) {
    partes.push(texto(linea("Pagado", datos.formatMoney(datos.pagado))));
  }
  if (datos.saldoPendiente !== undefined) {
    partes.push(new Uint8Array([ESC, 0x45, 1]));
    partes.push(texto(linea("SALDO PENDIENTE", datos.formatMoney(datos.saldoPendiente))));
    partes.push(new Uint8Array([ESC, 0x45, 0]));
  }
  partes.push(texto(separador));
  partes.push(new Uint8Array([ESC, 0x61, 1]));
  partes.push(texto("Gracias por su compra!\n"));
  partes.push(new Uint8Array([ESC, 0x64, 4])); // avanzar papel
  partes.push(new Uint8Array([GS, 0x56, 1])); // cortar papel (si el modelo lo soporta)

  return concat(partes);
}

export function construirTicketCierreCajaESCPOS(datos: {
  negocioNombre?: string;
  cajero: string;
  abiertaAt: string;
  cerradaAt: string;
  montoContado: number;
  diferencia: number;
  secciones: { titulo: string; nota?: string; lineas: { texto: string; monto: number; fuerte?: boolean }[] }[];
  formatMoney: (n: number) => string;
}): Uint8Array {
  const ancho = anchoCaracteresPapel();
  const separador = "-".repeat(ancho) + "\n";
  const linea = (izq: string, der: string) => {
    const espacio = Math.max(1, ancho - izq.length - der.length);
    return izq + " ".repeat(espacio) + der + "\n";
  };
  const negrita = (on: boolean) => new Uint8Array([ESC, 0x45, on ? 1 : 0]);

  const partes: Uint8Array[] = [
    new Uint8Array([ESC, 0x40]),
    new Uint8Array([ESC, 0x61, 1]),
    negrita(true),
    texto(`${datos.negocioNombre ?? "VentaTech"}\n`),
    negrita(false),
    texto("Cierre de caja\n"),
    new Uint8Array([ESC, 0x61, 0]),
    texto(separador),
    texto(`Cajero: ${datos.cajero}\n`),
    texto(`Apertura: ${new Date(datos.abiertaAt).toLocaleString("es-DO")}\n`),
    texto(`Cierre: ${new Date(datos.cerradaAt).toLocaleString("es-DO")}\n`),
    texto(separador),
  ];

  datos.secciones.forEach((seccion, i) => {
    partes.push(negrita(true), texto(`${seccion.titulo.toUpperCase()}\n`), negrita(false));
    if (seccion.nota) partes.push(texto(`${seccion.nota}\n`));
    for (const l of seccion.lineas) {
      if (l.fuerte) partes.push(negrita(true));
      partes.push(texto(linea(l.texto, datos.formatMoney(l.monto))));
      if (l.fuerte) partes.push(negrita(false));
    }
    if (i === 0) {
      partes.push(texto(linea("Contado", datos.formatMoney(datos.montoContado))));
      partes.push(negrita(true));
      partes.push(
        texto(
          linea(
            datos.diferencia === 0 ? "Cuadre exacto" : datos.diferencia > 0 ? "Sobrante" : "Faltante",
            datos.formatMoney(Math.abs(datos.diferencia))
          )
        )
      );
      partes.push(negrita(false));
    }
    partes.push(texto(separador));
  });

  partes.push(
    new Uint8Array([ESC, 0x61, 1]),
    texto("Firma cajero: ______________\n"),
    new Uint8Array([ESC, 0x64, 4]),
    new Uint8Array([GS, 0x56, 1])
  );

  return concat(partes);
}

type USBDeviceLike = {
  vendorId: number;
  productId: number;
  opened: boolean;
  configuration: {
    interfaces: {
      interfaceNumber: number;
      alternates: { endpoints: { endpointNumber: number; direction: string }[] }[];
    }[];
  } | null;
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(n: number): Promise<void>;
  claimInterface(n: number): Promise<void>;
  transferOut(endpoint: number, data: Uint8Array): Promise<unknown>;
};

function usbDisponible(): boolean {
  return typeof navigator !== "undefined" && "usb" in navigator;
}

export async function emparejarImpresoraUSB(): Promise<{ ok: boolean; mensaje: string }> {
  if (!usbDisponible()) {
    return { ok: false, mensaje: "Este navegador no soporta WebUSB. Usa Chrome/Edge en escritorio." };
  }
  try {
    // @ts-expect-error WebUSB no está tipado en el DOM lib estándar de TS
    const device = (await navigator.usb.requestDevice({ filters: [] })) as USBDeviceLike;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ vendorId: device.vendorId, productId: device.productId })
    );
    return { ok: true, mensaje: "Impresora USB emparejada. Las próximas facturas se imprimirán directo, sin ventanas." };
  } catch {
    // La causa más común no es que el usuario cancele: es que Windows/macOS
    // ya tiene instalado el driver normal de la impresora y no la deja
    // aparecer en la lista de WebUSB. En ese caso lo correcto es usar la
    // impresión por el navegador (ticket de respaldo) con esa misma
    // impresora ya instalada como predeterminada del sistema.
    return {
      ok: false,
      mensaje:
        "No se detectó ninguna impresora en la lista. Es normal: si tu impresora ya está instalada " +
        "como impresora normal de Windows/macOS, el navegador no puede tomarla por USB directo. " +
        "Usa la impresión por el sistema (abajo) en su lugar: funciona igual de bien.",
    };
  }
}

export function impresoraUSBConfigurada(): boolean {
  return typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY) !== null;
}

async function obtenerImpresoraUSB(): Promise<USBDeviceLike | null> {
  if (!usbDisponible()) return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    const { vendorId, productId } = JSON.parse(stored) as { vendorId: number; productId: number };
    // @ts-expect-error WebUSB no está tipado en el DOM lib estándar de TS
    const devices = (await navigator.usb.getDevices()) as USBDeviceLike[];
    return devices.find((d) => d.vendorId === vendorId && d.productId === productId) ?? null;
  } catch {
    return null;
  }
}

export async function imprimirESCPOS(bytes: Uint8Array): Promise<boolean> {
  const device = await obtenerImpresoraUSB();
  if (!device) return false;

  try {
    if (!device.opened) await device.open();
    if (device.configuration === null) await device.selectConfiguration(1);

    const iface = device.configuration?.interfaces.find((i) =>
      i.alternates.some((a) => a.endpoints.some((e) => e.direction === "out"))
    );
    if (!iface) {
      await device.close();
      return false;
    }

    await device.claimInterface(iface.interfaceNumber);
    const alternate = iface.alternates.find((a) => a.endpoints.some((e) => e.direction === "out"));
    const endpoint = alternate?.endpoints.find((e) => e.direction === "out");
    if (!endpoint) {
      await device.close();
      return false;
    }

    await device.transferOut(endpoint.endpointNumber, bytes);
    await device.close();
    return true;
  } catch {
    try {
      await device.close();
    } catch {
      // dispositivo ya cerrado o no disponible
    }
    return false;
  }
}
