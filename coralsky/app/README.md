# Coral Sky · app (PWA)

App móvil de la tienda Coral Sky Eyewear. Es una web app instalable (PWA): se abre en el navegador del teléfono y se puede agregar a la pantalla de inicio.

- Todo está en `index.html` (sin build). `manifest.webmanifest`, `sw.js` e íconos la hacen instalable y usable sin conexión.
- Por ahora es una versión de prueba: el carrito, la cuenta y los pedidos se guardan en el navegador y el pago es simulado.

## Publicar en Cloudflare Pages

Cloudflare → Workers & Pages → Create → Pages → Connect to Git → `keurymanuel368/NOCHEMAGIA`.

- Branch: `claude/relaxed-allen-zbi3kw`
- Framework preset: None
- Build command: (vacío)
- Build output directory: `coralsky/app`

Cada push a la rama vuelve a publicar la app.
