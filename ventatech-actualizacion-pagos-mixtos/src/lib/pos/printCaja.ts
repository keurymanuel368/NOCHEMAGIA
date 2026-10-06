import { formatMoney } from "@/lib/money";
import { efectivoEsperado, seccionesCierre, type CuadreTurno } from "@/lib/caja/cuadre";
import { construirTicketCierreCajaESCPOS, imprimirESCPOS } from "./escpos";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export type CierreCajaData = {
  negocioNombre?: string;
  cajero: string;
  abiertaAt: string;
  cerradaAt: string;
  montoInicial: number;
  /** Ventas por método, abonos, devoluciones y gastos del turno. */
  cuadre: CuadreTurno;
  montoContado: number;
};

function conDerivados(d: CierreCajaData) {
  const esperado = efectivoEsperado(d.montoInicial, d.cuadre);
  const diferencia = Math.round((d.montoContado - esperado) * 100) / 100;
  return { ...d, esperado, diferencia, secciones: seccionesCierre(d.cuadre, d.montoInicial) };
}

export async function imprimirCierreCaja(datos: CierreCajaData) {
  const completo = conDerivados(datos);
  const bytes = construirTicketCierreCajaESCPOS({ ...completo, formatMoney });
  const impresoDirecto = await imprimirESCPOS(bytes);
  if (impresoDirecto) return;
  imprimirCierreCajaNavegador(completo);
}

function imprimirCierreCajaNavegador(d: ReturnType<typeof conDerivados>) {
  const ancho = localStorage.getItem("vt_ancho_papel") === "58" ? "58mm" : "80mm";
  const ventana = window.open("", "_blank", "width=380,height=600");
  if (!ventana) return;

  const etiquetaDif = d.diferencia === 0 ? "Cuadre exacto" : d.diferencia > 0 ? "Sobrante" : "Faltante";
  const colorDif = d.diferencia === 0 ? "#555" : d.diferencia > 0 ? "#1b7f43" : "#c62828";

  const secciones = d.secciones
    .map(
      (s, i) => `
        <p class="titulo">${escapeHtml(s.titulo)}</p>
        ${s.nota ? `<p class="nota">${escapeHtml(s.nota)}</p>` : ""}
        <table>
          ${s.lineas
            .map(
              (l) =>
                `<tr class="${l.fuerte ? "grande" : ""}"><td>${escapeHtml(l.texto)}</td><td class="right">${formatMoney(l.monto)}</td></tr>`
            )
            .join("")}
          ${
            i === 0
              ? `<tr><td>Contado</td><td class="right">${formatMoney(d.montoContado)}</td></tr>
          <tr class="grande" style="color:${colorDif}"><td>${etiquetaDif}</td><td class="right">${formatMoney(Math.abs(d.diferencia))}</td></tr>`
              : ""
          }
        </table>
        <hr />`
    )
    .join("");

  ventana.document.write(`
    <html>
      <head>
        <title>Cierre de caja</title>
        <style>
          body { font-family: monospace; width: ${ancho}; margin: 0 auto; padding: 8px; font-size: 12px; }
          h1 { font-size: 14px; text-align: center; margin: 0 0 2px; }
          p { margin: 2px 0; }
          .titulo { font-weight: bold; text-transform: uppercase; margin-top: 4px; }
          .nota { font-size: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 4px; }
          td { padding: 2px 0; font-size: 12px; }
          hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
          .right { text-align: right; }
          .grande td { font-size: 13px; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(d.negocioNombre ?? "VentaTech")}</h1>
        <p style="text-align:center">Cierre de caja</p>
        <hr />
        <p>Cajero: ${escapeHtml(d.cajero)}</p>
        <p>Apertura: ${new Date(d.abiertaAt).toLocaleString("es-DO")}</p>
        <p>Cierre: ${new Date(d.cerradaAt).toLocaleString("es-DO")}</p>
        <hr />
        ${secciones}
        <p style="text-align:center">Firma cajero: ______________</p>
      </body>
    </html>
  `);
  ventana.document.close();
  ventana.focus();
  ventana.print();
}
