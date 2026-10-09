# VentaTech: pagos mixtos, cierre de caja detallado y dashboard corregido

## Revisión de todos los cálculos (10-oct)

No necesita SQL nuevo. Errores encontrados y corregidos:

| Dónde | Error | Corrección |
| --- | --- | --- |
| POS: total del carrito | No se redondeaba a centavos; con productos por peso (0.333 lb × RD$45) el total en pantalla podía diferir por centavos de la factura. | Cada línea y el total se redondean a centavos. |
| POS: descuento manual | Podía ser mayor que la venta: la pantalla mostraba RD$0 pero a la factura llegaba un descuento más grande que el subtotal. | Se limita a lo que queda después del cupón. |
| Ventas (servidor) | Aceptaba cantidades, precios o descuentos negativos si se mandaban por fuera de la pantalla. | Se rechazan. |
| Devoluciones | El total incluía productos de "venta rápida" que luego no se devolvían; no se podían devolver fracciones (libras, kg); si el mismo producto venía en dos líneas, lo devuelto se contaba doble; el monto ignoraba el descuento que tuvo la venta. | Venta rápida marcada como no devolvible; fracciones permitidas según la unidad; líneas agrupadas por producto; el monto mostrado es lo que el cliente realmente pagó. |
| Devoluciones: ventas del día | Usaba la hora de la computadora. | Hora de RD. |
| Compras | Aceptaba cantidades y precios negativos (una cantidad negativa restaba inventario). | Validado en pantalla y en el servidor. |
| Abonos | Montos con más de 2 decimales. | Redondeo a centavos (pantalla y servidor). |
| Gastos | Un gasto en cero o negativo sumaba dinero a la utilidad y a la caja. | Debe ser mayor que cero. |
| Inventario: valor al costo | Los productos con existencia negativa restaban valor. | Cuentan como cero. |
| Deudas pendientes | El dashboard y Clientes usaban el saldo guardado en cada cliente; Fiado sumaba las deudas una por una. Si no coincidían, cada pantalla daba otro número. | Las tres pantallas suman las deudas pendientes y parciales. |

## Corrección: cierre de caja y contabilidad (números que aparecían y desaparecían)

**Ejecuta `cierres-de-caja.sql`** en Supabase.

| Qué pasaba | Ahora |
| --- | --- |
| El historial de caja recalculaba los turnos viejos cada vez que se abría. Si después se anulaba una venta, se borraba un gasto o llegaba una venta sin conexión, un turno **ya cerrado** cambiaba solo. | Al cerrar se guarda una **foto del cuadre** (tabla `caja_cierres`). El historial muestra esa foto. Si algo cambió después, lo dice aparte en amarillo: "Cambió después del cierre: ventas +RD$ X, efectivo +RD$ Y". |
| Las ventas hechas **sin internet** se guardaban con la hora en que se sincronizaron. Si eso pasaba después de cerrar, caían en el turno siguiente: un turno con faltante y el otro con sobrante. | Se guardan con la **hora real en que se cobraron**. |
| **Contabilidad no restaba las devoluciones** pagadas en efectivo (el cierre de caja sí). "Ingresos reales" y "Utilidad" salían más altos. | Se restan, igual que en caja y en el Resumen ejecutivo. |
| Si una caja se quedaba abierta y se abría otra, la vieja seguía sumando las ventas de la nueva: aparecían en dos turnos. | La caja vieja termina donde empieza la siguiente. |
| El ticket de cierre usaba el cuadre de cuando se abrió la ventana; si alguien vendía mientras tanto, no cuadraba. | Se imprime el cuadre final, calculado con la hora exacta de cierre. Si cambió, avisa. |

Nota: Contabilidad cuenta por **día** (12:00 a. m. a 11:59 p. m.) y el cierre de caja por **turno**
(de que se abre a que se cierra). Si un turno pasa de medianoche, los dos números no tienen que
ser iguales.

## Nuevo: anular facturas (para limpiar las duplicadas)

**Ejecuta `anular-facturas.sql`** en Supabase.

Dónde: **POS → Historial → abre la factura → "Anular factura"**. Pide un motivo y confirmación.
Lo pueden hacer el **administrador del negocio** y el **super admin en modo soporte**
(el servidor lo comprueba; a un cajero no le aparece el botón).

Qué hace, todo junto (si algo falla, no cambia nada):
- La factura queda **anulada** (no se borra): sale de caja, dashboard, contabilidad y reportes.
- Los productos **vuelven al inventario**.
- Si fue a fiado (sin abonos), se quita la deuda y se recalcula el saldo del cliente.
- Queda registrado **quién, cuándo y por qué** (tabla `ventas_anuladas`). Si se hizo desde
  modo soporte, el nombre lleva "(soporte VentaTech)". Se ve en el detalle de la factura.

No deja anular facturas con devoluciones o con abonos (eso se resuelve aparte).
Si la factura tenía comprobante fiscal (NCF), repórtala como anulada en el formato 608 de la DGII.

Para limpiar duplicados: corre la consulta 3 de `velocidad-y-duplicados.sql`, anula cada
duplicado desde el POS y vuelve a ejecutar `velocidad-y-duplicados.sql` para activar la regla
que impide nuevos duplicados.

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
