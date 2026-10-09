import { formatMoney } from "@/lib/money";
import type { ResumenContable } from "./types";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatFecha(fecha: string) {
  const d = new Date(`${fecha}T00:00:00`);
  return d.toLocaleDateString("es-DO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function descargarReportePDF(
  resumen: ResumenContable,
  desde: string,
  hasta: string,
  negocioNombre = "VentaTech"
) {
  const ventana = window.open("", "_blank", "width=900,height=1000");
  if (!ventana) return;

  const filasVentasDia = resumen.ventasPorDia
    .map(
      (v) => `
        <tr>
          <td>${formatFecha(v.fecha)}</td>
          <td class="right">${formatMoney(v.total)}</td>
        </tr>`
    )
    .join("");

  const filasTopProductos = resumen.topProductos
    .map(
      (p) => `
        <tr>
          <td>${escapeHtml(p.nombre)}</td>
          <td class="right">${p.cantidad}</td>
          <td class="right">${formatMoney(p.monto)}</td>
        </tr>`
    )
    .join("");

  const filasGastos = resumen.gastosPorCategoria
    .map(
      (g) => `
        <tr>
          <td>${escapeHtml(g.categoria)}</td>
          <td class="right">${formatMoney(g.total)}</td>
        </tr>`
    )
    .join("");

  ventana.document.write(`
    <html>
      <head>
        <title>Reporte contable ${desde} a ${hasta}</title>
        <style>
          @page { size: A4; margin: 16mm; }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif;
            color: #1a1a1a;
            margin: 0;
            padding: 0;
          }
          .encabezado {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 3px solid #1565c0;
            padding-bottom: 12px;
            margin-bottom: 18px;
          }
          .marca { font-size: 22px; font-weight: 800; color: #1565c0; }
          .subtitulo { font-size: 12px; color: #667; margin-top: 2px; }
          .periodo { text-align: right; font-size: 12px; color: #445; }
          h2 {
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: #445;
            margin: 22px 0 8px;
            border-bottom: 1px solid #e2e6ef;
            padding-bottom: 6px;
          }
          .tarjetas {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
          }
          .tarjeta {
            border: 1px solid #e2e6ef;
            border-radius: 10px;
            padding: 10px 12px;
          }
          .tarjeta .label { font-size: 10px; text-transform: uppercase; color: #889; }
          .tarjeta .valor { font-size: 16px; font-weight: 800; margin-top: 3px; }
          .verde { color: #1b7f43; }
          .rojo { color: #c62828; }
          .azul { color: #1565c0; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #eef1f6; }
          th { font-size: 10px; text-transform: uppercase; color: #889; font-weight: 600; }
          .right { text-align: right; font-variant-numeric: tabular-nums; }
          .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
          .pie { margin-top: 26px; font-size: 10px; color: #99a; text-align: center; }
        </style>
      </head>
      <body>
        <div class="encabezado">
          <div>
            <div class="marca">${escapeHtml(negocioNombre)}</div>
            <div class="subtitulo">Reporte contable</div>
          </div>
          <div class="periodo">
            <div><strong>Período:</strong> ${formatFecha(desde)} — ${formatFecha(hasta)}</div>
            <div>Generado: ${new Date().toLocaleString("es-DO")}</div>
          </div>
        </div>

        <div class="tarjetas">
          <div class="tarjeta">
            <div class="label">Ventas totales</div>
            <div class="valor azul">${formatMoney(resumen.ventasTotal)}</div>
            <div class="subtitulo">${resumen.numVentas} venta(s)</div>
          </div>
          <div class="tarjeta">
            <div class="label">Ingresos reales</div>
            <div class="valor verde">${formatMoney(resumen.ingresosReales)}</div>
            <div class="subtitulo">ventas - fiado + abonos - devoluciones en efectivo</div>
          </div>
          <div class="tarjeta">
            <div class="label">Gastos</div>
            <div class="valor rojo">${formatMoney(resumen.gastosTotal)}</div>
            <div class="subtitulo">del período</div>
          </div>
          <div class="tarjeta">
            <div class="label">Utilidad</div>
            <div class="valor ${resumen.utilidad >= 0 ? "verde" : "rojo"}">${formatMoney(resumen.utilidad)}</div>
            <div class="subtitulo">ingresos - gastos</div>
          </div>
        </div>

        <h2>Ventas por método de pago</h2>
        <table>
          <tr><td>Efectivo</td><td class="right">${formatMoney(resumen.porMetodo.efectivo)}</td></tr>
          <tr><td>Tarjeta</td><td class="right">${formatMoney(resumen.porMetodo.tarjeta)}</td></tr>
          <tr><td>Transferencia</td><td class="right">${formatMoney(resumen.porMetodo.transferencia)}</td></tr>
          <tr><td>Fiado</td><td class="right">${formatMoney(resumen.porMetodo.fiado)}</td></tr>
          <tr><td>Abonos cobrados</td><td class="right">${formatMoney(resumen.abonosCobrados)}</td></tr>
          <tr><td>Devoluciones (total)</td><td class="right">-${formatMoney(resumen.devolucionesTotal)}</td></tr>
          <tr><td>Devoluciones pagadas en efectivo</td><td class="right">-${formatMoney(resumen.devolucionesEfectivo)}</td></tr>
        </table>

        <div class="grid2">
          <div>
            <h2>Top productos vendidos</h2>
            <table>
              <thead>
                <tr><th>Producto</th><th class="right">Cant.</th><th class="right">Monto</th></tr>
              </thead>
              <tbody>
                ${filasTopProductos || `<tr><td colspan="3">Sin ventas en el período</td></tr>`}
              </tbody>
            </table>
          </div>
          <div>
            <h2>Gastos por categoría</h2>
            <table>
              <thead>
                <tr><th>Categoría</th><th class="right">Total</th></tr>
              </thead>
              <tbody>
                ${filasGastos || `<tr><td colspan="2">Sin gastos en el período</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>

        <h2>Ventas por día</h2>
        <table>
          <thead>
            <tr><th>Fecha</th><th class="right">Total</th></tr>
          </thead>
          <tbody>
            ${filasVentasDia || `<tr><td colspan="2">Sin ventas en el período</td></tr>`}
          </tbody>
        </table>

        <div class="pie">${escapeHtml(negocioNombre)} · Reporte generado automáticamente</div>
      </body>
    </html>
  `);
  ventana.document.close();
  ventana.focus();
  ventana.print();
}
