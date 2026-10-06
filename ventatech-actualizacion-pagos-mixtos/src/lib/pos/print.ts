import { formatMoney } from "@/lib/money";
import { construirTicketESCPOS, imprimirESCPOS } from "./escpos";
import { imprimirViaAgenteLocal } from "./printAgent";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export type FacturaData = {
  negocioNombre?: string;
  numeroFactura: string;
  ncf?: string;
  fecha: string;
  cajero: string;
  cliente: string;
  metodoPago: string;
  /** Pago mixto: cuánto se pagó con cada método. */
  pagos?: { etiqueta: string; monto: number }[];
  items: { nombre: string; cantidad: number; subtotal: number }[];
  subtotal: number;
  descuento: number;
  total: number;
  montoRecibido?: number;
  cambio?: number;
  /** Reimpresión de una factura ya emitida: se marca como COPIA. */
  esCopia?: boolean;
  /** Para ventas a fiado: lo abonado hasta hoy y lo que falta por pagar. */
  pagado?: number;
  saldoPendiente?: number;
};

export async function imprimirFactura(datos: FacturaData) {
  const bytes = construirTicketESCPOS({ ...datos, formatMoney });

  // Orden de intento: agente local (imprime directo, sin diálogo, sin
  // depender del navegador) → WebUSB directo → ticket de respaldo del
  // navegador (requiere confirmar el diálogo de impresión del sistema).
  if (await imprimirViaAgenteLocal(bytes)) return;

  const impresoDirecto = await imprimirESCPOS(bytes);
  if (impresoDirecto) return;

  imprimirFacturaNavegador(datos);
}

function imprimirFacturaNavegador(datos: FacturaData) {
  const ancho = localStorage.getItem("vt_ancho_papel") === "58" ? "58mm" : "80mm";
  const ventana = window.open("", "_blank", "width=380,height=600");
  if (!ventana) return;

  const filas = datos.items
    .map(
      (it) => `
        <tr>
          <td>${escapeHtml(it.nombre)}</td>
          <td class="right">${it.cantidad}</td>
          <td class="right">${formatMoney(it.subtotal)}</td>
        </tr>`
    )
    .join("");

  ventana.document.write(`
    <html>
      <head>
        <title>${escapeHtml(datos.numeroFactura)}</title>
        <style>
          body { font-family: monospace; width: ${ancho}; margin: 0 auto; padding: 8px; font-size: 12px; }
          h1 { font-size: 14px; text-align: center; margin: 0 0 2px; }
          p { margin: 2px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 6px; }
          td { padding: 2px 0; font-size: 11px; vertical-align: top; }
          hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
          .right { text-align: right; }
          .totales td { padding: 1.5px 0; font-size: 12px; }
          .grande td { font-size: 14px; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(datos.negocioNombre ?? "VentaTech")}</h1>
        <p style="text-align:center">Factura ${escapeHtml(datos.numeroFactura)}</p>
        ${datos.ncf ? `<p style="text-align:center">NCF: ${escapeHtml(datos.ncf)}</p>` : ""}
        <p style="text-align:center">${new Date(datos.fecha).toLocaleString("es-DO")}</p>
        ${
          datos.esCopia
            ? `<p style="text-align:center;font-weight:bold">*** COPIA ***</p>
        <p style="text-align:center">Reimpresa: ${new Date().toLocaleString("es-DO")}</p>`
            : ""
        }
        <hr />
        <p>Cliente: ${escapeHtml(datos.cliente)}</p>
        <p>Cajero: ${escapeHtml(datos.cajero)}</p>
        <hr />
        <table>
          ${filas}
        </table>
        <hr />
        <table class="totales">
          <tr><td>Subtotal</td><td class="right">${formatMoney(datos.subtotal)}</td></tr>
          ${
            datos.descuento > 0
              ? `<tr><td>Descuento</td><td class="right">-${formatMoney(datos.descuento)}</td></tr>`
              : ""
          }
          <tr class="grande"><td>TOTAL</td><td class="right">${formatMoney(datos.total)}</td></tr>
          <tr><td>Método</td><td class="right">${escapeHtml(datos.metodoPago)}</td></tr>
          ${(datos.pagos ?? [])
            .map((p) => `<tr><td>&nbsp;&nbsp;${escapeHtml(p.etiqueta)}</td><td class="right">${formatMoney(p.monto)}</td></tr>`)
            .join("")}
          ${
            datos.montoRecibido !== undefined
              ? `<tr><td>Recibido</td><td class="right">${formatMoney(datos.montoRecibido)}</td></tr>`
              : ""
          }
          ${
            datos.cambio !== undefined
              ? `<tr><td>Cambio</td><td class="right">${formatMoney(datos.cambio)}</td></tr>`
              : ""
          }
          ${
            datos.pagado !== undefined
              ? `<tr><td>Pagado</td><td class="right">${formatMoney(datos.pagado)}</td></tr>`
              : ""
          }
          ${
            datos.saldoPendiente !== undefined
              ? `<tr class="grande"><td>SALDO PENDIENTE</td><td class="right">${formatMoney(datos.saldoPendiente)}</td></tr>`
              : ""
          }
        </table>
        <hr />
        <p style="text-align:center">¡Gracias por su compra!</p>
      </body>
    </html>
  `);
  ventana.document.close();
  ventana.focus();
  ventana.print();
}
