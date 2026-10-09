# VentaTech: pagos mixtos, cierre de caja detallado y dashboard corregido

## ⚠ Actualización 9-oct: facturas cobradas dos veces y lentitud

**Ejecuta también `velocidad-y-duplicados.sql`** en Supabase (después de `pagos-mixtos.sql`).

Qué pasaba:
- Cada intento de cobro generaba un código de venta nuevo. Si el cajero daba doble clic, o si
  el servidor tardaba en responder, el segundo intento se guardaba como otra venta.
- Después de cada venta, el servidor recargaba toda la pantalla del POS (todos los productos y
  el cuadre de caja) antes de responder. Con internet lento, Vercel cortaba la función después
  de guardar la venta; el POS creía que había fallado, la guardaba "sin conexión" y luego la
  volvía a mandar: factura doble.

Qué se corrigió:
- **Un solo código por cobro:** reintentar el mismo carrito manda el mismo código; el servidor
  devuelve la venta que ya existe.
- **Doble clic bloqueado:** mientras una venta se procesa, no se acepta otra.
- **Respuesta rápida:** guardar la venta ya no espera a recargar el POS; se refresca solo después.
- **POS más liviano:** el cuadre de caja se calcula solo al abrir la ventana de cierre.
- **Sincronización offline:** si el POS está abierto en dos pestañas, solo una sincroniza.
- **Base de datos (SQL):** índices para que las consultas sean rápidas, y una regla que impide
  guardar dos ventas con el mismo código. Si ya tienes facturas duplicadas, el SQL te avisa y
  no crea la regla hasta que las anules. La consulta 3 del archivo las lista.

## Cómo aplicar (en este orden)

1. **Supabase → SQL Editor:** pega `pagos-mixtos.sql` y dale a **Run** (una sola vez).
   Crea la tabla `venta_pagos` y permite el método `mixto`.
2. **Código:** copia la carpeta `src` de este paquete encima de la de tu proyecto
   (reemplaza los archivos). Otra opción, con Git: `git apply cambios-pagos-mixtos.patch`.
3. `npm run build` y sube a GitHub. Vercel lo publica solo.

> La variable `SUPABASE_SERVICE_ROLE_KEY` tiene que estar en Vercel (ya la usa la
> pantalla de Usuarios). Con ella el servidor guarda cómo se pagó cada venta.

## 1. Pagos mixtos y débito o crédito (nuevo)

Al darle a **Cobrar** aparecen 5 métodos: Efectivo, Tarjeta, Transf., Fiado y **Mixto**.

- **Tarjeta:** hay que elegir **Débito** o **Crédito** antes de confirmar.
- **Mixto:** pones cuánto va en **tarjeta** (y eliges débito o crédito) y/o cuánto va
  en **transferencia**. **El resto se cobra en efectivo** y el sistema lo calcula solo.
  Si escribes cuánto efectivo te dieron, te dice el cambio. El botón "Poner el resto"
  llena el monto que falta.
  - Ejemplo: total RD$ 1,000 → tarjeta débito 600 → efectivo 400.
- El ticket muestra el desglose ("Mixto: Efectivo 400 / Tarjeta débito 600").
- El historial del POS, el detalle de la venta y la copia de la factura también lo muestran.
- El fiado no entra en el pago mixto (la venta a fiado sigue siendo aparte).

## 2. Cierre de caja: cuánto contar y cuánto se vendió (mejorado)

La pantalla de Caja, la ventana de cierre y el ticket de cierre muestran ahora 3 bloques:

**Efectivo en la gaveta (lo que debes contar)**
Monto inicial + ventas en efectivo (incluida la parte en efectivo de los pagos mixtos)
+ abonos de fiado en efectivo − devoluciones en efectivo − gastos pagados en efectivo
= **Efectivo esperado**. Pones lo contado y te dice sobrante o faltante.

**Ventas del turno:** efectivo, tarjeta débito, tarjeta crédito, transferencia, fiado,
**total vendido**, y si hubo devoluciones, la **venta neta**.

**Para cuadrar con el banco / verifone:** total en tarjetas y en transferencias
(lo que no está en la gaveta).

## 3. Errores de cálculo corregidos

| Dónde | Qué pasaba | Ahora |
| --- | --- | --- |
| Historial de caja y PDF de caja | La "Diferencia" era *monto final − monto inicial*: era casi lo vendido en efectivo, no el sobrante/faltante. | Diferencia = contado − efectivo esperado del turno. Se agregaron las columnas "Vendido" y "Efectivo esperado". |
| Cierre de caja | No se tomaban en cuenta los abonos de fiado en efectivo, las devoluciones en efectivo ni los gastos en efectivo. Por eso salían sobrantes o faltantes que no eran reales. | Entran en el efectivo esperado. |
| Dashboard: Ventas del mes, gráfico de 30 días, comparación anual, Contabilidad, Resumen ejecutivo | Supabase devuelve **máximo 1000 filas por consulta**. Con más de 1000 ventas en el período, el resto no se sumaba y los números salían **más bajos** de lo vendido. | Las ventas se traen por páginas: se suman todas. |
| Dashboard: ventas del día, del mes y gráficos | Las devoluciones no se restaban: la venta se quedaba "completada" con su total completo, y el número salía **más alto** de lo vendido. | Se restan el día en que se hicieron (venta neta). La tarjeta indica las devoluciones. |
| Comparación anual | Usaba el mes en hora UTC: las ventas del último día del mes después de las 8:00 p. m. caían en el mes siguiente. | Mes en hora de RD. |
| Contabilidad: ventas por día | Mismo problema de hora UTC. | Día en hora de RD. |
| Gráfico del dashboard | Solo tenía "7 días" y "30 días": los 30 días mezclaban el mes pasado con el actual. | Ahora es "7 días" y **"Este mes"** (desde el día 1; si hoy es día 1, solo hoy), con el total del rango. |
| Fecha "de hoy" en RD | Dependía del formato de fecha del servidor. | Se calcula directo con UTC−4, siempre YYYY-MM-DD. |
| Tarjeta "Ingresos del mes" | Incluía el fiado (aún no cobrado), así que no cuadraba con "Ingresos reales" de Contabilidad. | Se llama **"Ventas del mes"**, que es lo que mide. |

La tarjeta **"Ventas del día"** del dashboard es igual a la **"Venta neta"** del cierre de
caja (mismo turno) y muestra efectivo, tarjeta, transferencia y fiado.

La tarjeta **"Ventas del mes"** cuenta solo desde el día 1 del mes actual hasta hoy, y lo
dice en la tarjeta ("del 1 oct. a hoy · N ventas"), junto con el fiado incluido y las devoluciones.

## 4. Listados completos (sin corte de 1000 filas)

Supabase entrega como máximo 1000 filas por consulta. Ahora todos los listados piden las
filas por páginas de 1000 hasta traerlas todas (archivo nuevo `src/lib/supabase/paginar.ts`):

- **POS:** Historial del día y **la lista de productos y clientes del POS** (antes, con más
  de 1000 productos, los demás no aparecían para vender).
- **Reportes:** Ventas, Inventario, Clientes con deuda, Gastos y Abonos, y sus Excel/PDF.
- **Contabilidad:** lista de gastos y productos más vendidos.
- **Clientes / Fiado:** lista de clientes, deudas (antes solo las últimas 200), abonos y totales.
- **Inventario:** productos (antes máximo 3000/1000), totales del inventario y compras
  (antes solo las últimas 50).
- **Devoluciones:** lista y totales del día/mes.
- **Dashboard:** deudas pendientes, productos bajos y el panel de stock bajo (antes revisaba
  solo los 50 productos con menos existencia).

Se dejaron a propósito con límite: "Últimas ventas" del dashboard (8), el historial de caja
(últimos 30 turnos) y las búsquedas puntuales.

## Archivos

Nuevos: `src/lib/pagos.ts`, `src/lib/supabase/paginar.ts`, `src/lib/caja/cuadre.ts`, `src/lib/ventas/movimientos.ts`, `pagos-mixtos.sql`.

Modificados: ver `archivos-modificados.txt`.

## Verificado
- `tsc` sin errores nuevos. `next build` correcto.
- `eslint`: los mismos 4 avisos que ya tenía el proyecto, ninguno nuevo.
- Prueba del cuadre con un turno de ejemplo (efectivo, mixto, débito, crédito, transferencia,
  fiado, devolución, abono y gasto): el efectivo esperado y los totales dan exacto.
- No se probó contra tu base de datos real (no tengo acceso). Prueba primero una venta mixta
  y un cierre de caja.

## Ten en cuenta
- Las ventas viejas con tarjeta no tienen tipo: salen como "Tarjeta (sin tipo)".
- Si una venta se guarda pero falla el desglose (por ejemplo, si no ejecutaste el SQL),
  aparece un aviso y esa venta se cuenta completa en su método principal.
- Una venta hecha sin internet se registra con la hora en que se sincroniza. Si se
  sincroniza después de cerrar la caja, cuenta en el turno siguiente (esto ya pasaba antes).
