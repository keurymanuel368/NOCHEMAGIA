# DEXA Vet · MVP de demostración

Demo navegable de DEXA Vet para presentar a clínicas veterinarias. Es un sitio estático (HTML, CSS y JS sin dependencias) listo para **Cloudflare Pages**. Los datos son de ejemplo, viven en el navegador (`localStorage`) y se reinician desde el menú lateral ("Reiniciar datos de demo").

## Qué muestra

| Módulo | Qué se ve en la demo |
|---|---|
| Inicio | Citas del día, ingresos, vacunas por vencer, stock bajo y la tarjeta **Tiempo DEXA** (mide en vivo cuánto tarda una consulta completa). |
| Agenda | Citas por día, estado (Programada / En sala / Atendida), "Llegó", "Atender" y recordatorios de mañana por WhatsApp. |
| Pacientes | Búsqueda por nombre, raza, dueño o teléfono; ficha con historia clínica, vacunas, facturas y curva de peso. |
| Consulta | Plantillas de un toque (vacunación, desparasitación, piel, control), SOAP, dosis sugerida por peso, alerta de alergias, cobro con ITBIS, próxima cita automática y resumen para el dueño con IA. |
| Vacunas | Vencidas y próximas 30 días con mensaje de WhatsApp ya escrito. |
| Caja | Cierre del día por método de pago, ITBIS cobrado y comprobantes (e-CF simulado). |
| Inventario | Existencias, alertas de mínimo y entradas; se descuenta solo al guardar la consulta. |
| Reportes | Ingresos de 7 días, lo que más vende y tiempo promedio por consulta. |

Atajos: `Ctrl K` o `/` abre la búsqueda rápida.

## Probar en local

```bash
cd dexa-vet
npx wrangler pages dev public     # o: python3 -m http.server 8787 -d public
```

## Publicar en Cloudflare Pages

**Opción A · desde la terminal (más rápido)**

```bash
cd dexa-vet
npx wrangler login
npx wrangler pages deploy public --project-name dexa-vet-demo
```

Queda en `https://dexa-vet-demo.pages.dev`.

**Opción B · conectado a GitHub (se publica solo con cada push)**

1. Cloudflare → Workers & Pages → Create → Pages → Connect to Git.
2. Elegir este repositorio y la rama.
3. Framework preset: *None*. Build command: vacío. Build output directory: `dexa-vet/public`.
4. Save and Deploy.

Para usar un subdominio propio (por ejemplo `vet.dexa.com.do`), agregarlo en *Custom domains* del proyecto.

## Notas honestas para la demo

- El "Asistente IA" arma el resumen con los datos de la consulta; en producción se conecta a un modelo de IA.
- Los comprobantes son **simulados**. La emisión real de e-CF depende de la certificación ante la DGII.
- La referencia de ~14 min "con cuaderno y Excel" es una estimación; conviene preguntarle a la clínica su tiempo real y usar ese número.
- La dosis sugerida es una ayuda de cálculo; la decide siempre el veterinario.
