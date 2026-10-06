import { redirect } from "next/navigation";
import { Monitor, TrendingUp, CreditCard, PackageX, Receipt, Users } from "lucide-react";
import { getUsuarioActual } from "@/lib/get-usuario-actual";
import {
  getDashboardStats,
  getVentasUltimosDias,
  getUltimasVentas,
  getStockBajo,
  getComparativaAnual,
  calcularVariacionPct,
} from "@/lib/dashboard/queries";
import { AppShell } from "@/components/layout/AppShell";
import { StatMini } from "@/components/inventario/StatMini";
import { StockAlertBanner } from "@/components/dashboard/StockAlertBanner";
import { SalesChart } from "@/components/dashboard/SalesChart";
import { YearComparisonChart } from "@/components/dashboard/YearComparisonChart";
import { UltimasVentasTable } from "@/components/dashboard/UltimasVentasTable";
import { StockBajoPanel } from "@/components/dashboard/StockBajoPanel";
import { formatMoney } from "@/lib/money";
import { ZONA_NEGOCIO } from "@/lib/fecha-rd";

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-DO", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: ZONA_NEGOCIO,
  });
}

/** "2026-10-01" → "1 oct." */
function fechaCorta(fecha: string) {
  return new Date(`${fecha}T12:00:00Z`).toLocaleDateString("es-DO", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export default async function Home() {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect("/login");

  const [stats, ventasPorDia, ultimasVentas, stockBajo, comparativaAnual] = await Promise.all([
    getDashboardStats(),
    // 31 días: alcanza para el mes completo y para "7 días".
    getVentasUltimosDias(31),
    getUltimasVentas(),
    getStockBajo(),
    getComparativaAnual(),
  ]);

  const variacionHoy = calcularVariacionPct(stats.ventasHoyTotal, stats.ventasAyerTotal);
  // Mismo rango que el cierre de caja: de la apertura al cierre del turno.
  const turnoTexto = !stats.turno
    ? "hoy"
    : stats.turno.cerradaAt
      ? `turno ${hora(stats.turno.abiertaAt)} – ${hora(stats.turno.cerradaAt)}`
      : `caja abierta desde ${hora(stats.turno.abiertaAt)}`;
  const anteriorTexto = stats.turno ? "turno anterior" : "ayer";
  const variacionMes = calcularVariacionPct(stats.ingresosMesTotal, stats.ingresosMesAnteriorTotal);

  return (
    <AppShell usuario={usuario} title="Dashboard">
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatMini
            icon={Monitor}
            accent="from-blue-400 to-blue-600"
            label="Ventas del día"
            value={formatMoney(stats.ventasHoyTotal)}
            sub={[
              turnoTexto,
              `${stats.ventasHoyCount} ventas`,
              `efectivo ${formatMoney(stats.ventasHoyEfectivo)}`,
              `tarjeta ${formatMoney(stats.ventasHoyTarjeta)}`,
              `transf. ${formatMoney(stats.ventasHoyTransferencia)}`,
              ...(stats.ventasHoyFiado > 0 ? [`fiado ${formatMoney(stats.ventasHoyFiado)}`] : []),
              ...(stats.ventasHoyDevoluciones > 0
                ? [`devoluciones −${formatMoney(stats.ventasHoyDevoluciones)}`]
                : []),
              `${anteriorTexto} ${formatMoney(stats.ventasAyerTotal)}`,
            ].join(" · ")}
            delta={{ pct: variacionHoy, label: `vs. ${anteriorTexto}` }}
          />
          <StatMini
            icon={TrendingUp}
            accent="from-green-400 to-green-600"
            label="Ventas del mes"
            value={formatMoney(stats.ingresosMesTotal)}
            sub={[
              `del ${fechaCorta(stats.mesDesde)} a hoy`,
              `${stats.ventasMesCount} ventas`,
              ...(stats.ventasMesFiado > 0 ? [`incluye fiado ${formatMoney(stats.ventasMesFiado)}`] : []),
              ...(stats.ventasMesDevoluciones > 0
                ? [`devoluciones −${formatMoney(stats.ventasMesDevoluciones)}`]
                : []),
              `mes pasado ${formatMoney(stats.ingresosMesAnteriorTotal)}`,
            ].join(" · ")}
            delta={{ pct: variacionMes, label: "vs. mes pasado" }}
          />
          <StatMini
            icon={CreditCard}
            accent="from-amber-400 to-amber-600"
            label="Deudas pendientes"
            value={formatMoney(stats.deudasPendientesTotal)}
            sub={`${stats.clientesConDeuda} clientes con deuda`}
          />
          <StatMini
            icon={PackageX}
            accent="from-red-400 to-red-600"
            label="Productos bajos"
            value={String(stats.productosBajos)}
            sub="Stock mínimo alcanzado"
          />
          <StatMini
            icon={Receipt}
            accent="from-purple-400 to-purple-600"
            label="Ticket promedio"
            value={formatMoney(stats.ticketPromedio)}
            sub={`${stats.ventasHoyCount} ventas del día`}
          />
          <StatMini
            icon={Users}
            accent="from-emerald-400 to-emerald-600"
            label="Clientes atendidos"
            value={String(stats.clientesAtendidosHoy)}
            sub="ventas del día"
          />
        </div>

        <StockAlertBanner
          agotados={stats.productosAgotados}
          bajos={stats.productosStockBajoNoAgotados}
        />

        <SalesChart data={ventasPorDia} mesDesde={stats.mesDesde} />

        <YearComparisonChart data={comparativaAnual} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <UltimasVentasTable ventas={ultimasVentas} />
          </div>
          <StockBajoPanel productos={stockBajo} />
        </div>
      </div>
    </AppShell>
  );
}
