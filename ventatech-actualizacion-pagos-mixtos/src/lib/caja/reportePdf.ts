import { formatMoney } from "@/lib/money";
import type { CajaSesion } from "./queries";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function descargarReporteCaja(
  historial: CajaSesion[],
  cajaActual: CajaSesion | null,
  negocioNombre = "VentaTech"
) {
  const ventana = window.open("", "_blank", "width=900,height=1000");
  if (!ventana) return;

  const filas = historial
    .map((c) => {
      // Contado contra el efectivo esperado del turno (no contra el monto inicial).
      const diferencia = c.diferencia;
      const colorDif = diferencia === null ? "#889" : diferencia >= 0 ? "#1b7f43" : "#c62828";
      return `
        <tr>
          <td>${escapeHtml(c.cajero_nombre)}</td>
          <td>${new Date(c.abierta_at).toLocaleString("es-DO")}</td>
          <td>${c.cerrada_at ? new Date(c.cerrada_at).toLocaleString("es-DO") : "—"}</td>
          <td class="right">${formatMoney(c.monto_inicial)}</td>
          <td class="right">${formatMoney(c.cuadre.ventaNeta)}${
            c.cambios_posteriores
              ? `<div style="font-size:10px;color:#b26a00">Cambió después del cierre: ventas ${formatMoney(c.cambios_posteriores.ventas)}, efectivo ${formatMoney(c.cambios_posteriores.efectivo)}</div>`
              : ""
          }</td>
          <td class="right">${formatMoney(c.efectivo_esperado)}</td>
          <td class="right">${c.monto_final !== null ? formatMoney(c.monto_final) : "—"}</td>
          <td class="right" style="color:${colorDif}">${diferencia !== null ? formatMoney(diferencia) : "—"}</td>
          <td>${c.estado === "abierta" ? "Abierta" : "Cerrada"}</td>
        </tr>`;
    })
    .join("");

  const totalInicial = historial.reduce((s, c) => s + c.monto_inicial, 0);
  const totalFinal = historial.reduce((s, c) => s + (c.monto_final ?? 0), 0);
  const totalDiferencia = historial.reduce((s, c) => s + (c.diferencia ?? 0), 0);

  ventana.document.write(`
    <html>
      <head>
        <title>Reporte de caja</title>
        <style>
          @page { size: A4; margin: 16mm; }
          * { box-sizing: border-box; }
          body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #1a1a1a; margin: 0; }
          .encabezado {
            display: flex; align-items: center; justify-content: space-between;
            border-bottom: 3px solid #1565c0; padding-bottom: 12px; margin-bottom: 18px;
          }
          .marca { font-size: 22px; font-weight: 800; color: #1565c0; }
          .subtitulo { font-size: 12px; color: #667; margin-top: 2px; }
          .periodo { text-align: right; font-size: 12px; color: #445; }
          h2 {
            font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: #445;
            margin: 22px 0 8px; border-bottom: 1px solid #e2e6ef; padding-bottom: 6px;
          }
          .tarjetas { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
          .tarjeta { border: 1px solid #e2e6ef; border-radius: 10px; padding: 10px 12px; }
          .tarjeta .label { font-size: 10px; text-transform: uppercase; color: #889; }
          .tarjeta .valor { font-size: 16px; font-weight: 800; margin-top: 3px; }
          .verde { color: #1b7f43; }
          .rojo { color: #c62828; }
          .azul { color: #1565c0; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #eef1f6; }
          th { font-size: 10px; text-transform: uppercase; color: #889; font-weight: 600; }
          .right { text-align: right; font-variant-numeric: tabular-nums; }
          .pie { margin-top: 26px; font-size: 10px; color: #99a; text-align: center; }
        </style>
      </head>
      <body>
        <div class="encabezado">
          <div>
            <div class="marca">${escapeHtml(negocioNombre)}</div>
            <div class="subtitulo">Reporte de caja</div>
          </div>
          <div class="periodo">
            <div>Generado: ${new Date().toLocaleString("es-DO")}</div>
            <div>${cajaActual ? `Caja actual: abierta por ${escapeHtml(cajaActual.cajero_nombre)}` : "Caja actual: cerrada"}</div>
          </div>
        </div>

        <div class="tarjetas">
          <div class="tarjeta">
            <div class="label">Total montos iniciales</div>
            <div class="valor azul">${formatMoney(totalInicial)}</div>
          </div>
          <div class="tarjeta">
            <div class="label">Total montos finales</div>
            <div class="valor azul">${formatMoney(totalFinal)}</div>
          </div>
          <div class="tarjeta">
            <div class="label">Sobrante / faltante acumulado</div>
            <div class="valor ${totalDiferencia >= 0 ? "verde" : "rojo"}">${formatMoney(totalDiferencia)}</div>
          </div>
        </div>

        <h2>Historial de sesiones de caja</h2>
        <table>
          <thead>
            <tr>
              <th>Cajero</th><th>Apertura</th><th>Cierre</th>
              <th class="right">Monto inicial</th><th class="right">Vendido</th>
              <th class="right">Efectivo esperado</th><th class="right">Contado</th>
              <th class="right">Diferencia</th><th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${filas || `<tr><td colspan="9">Sin historial de caja</td></tr>`}
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
