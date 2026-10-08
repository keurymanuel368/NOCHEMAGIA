# Bitácora de la sesión con IA · Maker Lab · Desafío Naranja 2026

**Proyecto:** DEXA Technologies · **Herramienta:** Claude (Anthropic) · **Fecha:** 8 de octubre de 2026

Transcripción de las tres rondas que se resumen en la sección 4 del entregable.

---

## Ronda 1 · Prompt Maestro

> `<rol>` Eres estratega de producto y storytelling para startups de software latinoamericanas y has sido jurado de concursos de economía naranja. Lees cada frase como lo haría el dueño de una PYME dominicana sin formación técnica: si algo suena a jerga, lo descartas. `</rol>` `<contexto>` DEXA Technologies es una empresa de software fundada en Constanza, República Dominicana, por un estudiante de Ingeniería de Software. Crea software especializado por sector, con IA integrada, soporte local en español y precios en pesos. Portafolio: BiblioTech (gestión de bibliotecas con catálogo, préstamos, portal del lector y reportes; demo funcional; es el producto de la demo en vivo), sistema de facturación electrónica e-CF, DEXA Vet (gestión veterinaria, en desarrollo), After (hábitos y finanzas con IA, lanzada) y proyectos entregados a clientes (psicologo.do, LIDERA ERP). Cliente objetivo: organizaciones y PYMES que aún operan con cuadernos, Excel o WhatsApp. Competencia: desarrolladoras locales sin producto propio y plataformas extranjeras cobradas en dólares y sin soporte local. Mascota: HALO, un robot con cabeza de monitor retro y hoodie blanco. Lema: «Diseñando tecnología para un mundo más inteligente». `</contexto>` `<tarea>` 1) Construye la ficha del cliente ideal (perfil, dolores, beneficios esperados y objeciones). 2) Redacta 3 variantes de Propuesta Única de Valor (máximo 30 palabras cada una), elige la más fuerte y justifica la elección. 3) Diseña el arco de un pitch de 3 minutos para el Desafío Naranja 2026 guiado por HALO. 4) Evalúa tu propio resultado como jurado y corrige lo débil antes de entregar. `</tarea>` `<formato>` Ficha en viñetas; PUV en un cuadro delimitado; pitch en una tabla de 5 escenas (tiempo · qué dice HALO · qué se ve en pantalla); al final, una rúbrica del 1 al 5 con la versión corregida de todo lo que obtenga menos de 4. `</formato>` `<restricciones>` Usa español claro y un tono profesional y cercano. No uses «innovador», «escalable», «SaaS» ni «transformación digital». No inventes cifras, clientes ni estadísticas; si falta un dato, escribe [POR CONFIRMAR]. Si falta algo crítico, hazme como máximo 3 preguntas antes de empezar; si no falta nada, procede. `</restricciones>`

### Respuesta de la IA

**Ficha del cliente ideal**
- **Perfil:** dueño o administrador de una PYME u organización dominicana de 2 a 20 personas (bibliotecas, clínicas, comercios y oficinas) que factura formalmente.
- **Cómo opera:** registros en cuadernos y Excel; coordinación por WhatsApp.
- **Dolores:** pierde tiempo buscando información, comete errores al registrar y no tiene reportes para decidir.
- **Beneficios esperados:** orden, tiempo libre y control.
- **Objeciones:** precio, miedo a la tecnología y dudas sobre el soporte.

**Variantes de PUV**
1. «Software hecho para tu tipo de negocio, en español, en pesos y con gente de aquí que te responde.»
2. «DEXA convierte el cuaderno y el WhatsApp de tu negocio en un sistema que trabaja por ti.»
3. «Lo que las plataformas extranjeras te cobran en dólares, DEXA te lo da en pesos, en español y hecho para tu sector.»

> **Elegida: la 1**, porque resume los tres diferenciadores (sector, idioma y precio, soporte local).

**Pitch (5 escenas)**

| Tiempo | HALO dice | En pantalla |
|---|---|---|
| 0:00–0:30 | «Hola, soy HALO. Vengo a hablarles de los negocios que todavía funcionan con papel.» | HALO saluda |
| 0:30–1:00 | Problema general de las PYMES: desorden, errores y tiempo perdido | Íconos de cuaderno, Excel y WhatsApp |
| 1:00–1:50 | Demo de BiblioTech | Catálogo, préstamo y reportes |
| 1:50–2:30 | «Y no solo bibliotecas: también tenemos facturación electrónica, DEXA Vet y After.» | Logos de los 4 productos |
| 2:30–3:00 | «Contáctanos y digitaliza tu negocio.» | Contacto y lema |

**Rúbrica:** claridad 4 · diferenciación 4 · emoción 3 · credibilidad 4 · llamado a la acción 3.
**Correcciones:** emoción → «Agregar una historia de un cliente». Llamado a la acción → «Invitar a agendar una demo».

### Lo que se detectó al revisarla
- **La historia no coincide con la demo:** el cliente ideal abarca cinco sectores, pero la demo es de bibliotecas.
- **La escena 4 vuelve a «hacemos de todo»:** enumera cuatro productos, que es justo el problema que había que resolver.
- **Poca emoción:** no hay ningún personaje humano. La IA lo detectó (3/5), pero su corrección quedó en una frase abstracta.
- **Llamado a la acción vago:** «contáctanos» no le pide nada concreto al público.
- **Falta la IA:** no dice dónde está la IA en la propuesta.

---

## Ronda 2 · Re-prompt de enfoque

> «La demo es BiblioTech, así que el cliente ancla tiene que ser una biblioteca, no cinco sectores. Reescribe la ficha para la persona encargada de la biblioteca de un colegio, una universidad o un municipio, y separa a quien usa el sistema de quien aprueba el pago. Cuenta el dolor con un personaje (caso ilustrativo, sin cifras inventadas). En el pitch, los demás productos van en una sola línea, como prueba de que el método se repite. Dime con honestidad dónde aparece la IA, sin prometer funciones que no estén construidas. Vuelve a puntuarte y justifica cada nota con una frase.»

### Respuesta de la IA (resumen)
- **Usuario:** la persona encargada de la biblioteca, con un equipo de 1 a 3 personas. **Quien aprueba el pago:** la dirección o la administración del centro.
- **Dolores concretos:** no sabe qué libros están prestados ni quién los tiene; los libros que no vuelven a fin de año; un inventario que toma días; los reportes que la dirección pide y hay que armar a mano.
- **Personaje:** la bibliotecaria de un colegio, al cierre del año escolar, buscando en un cuaderno con tachones quién tiene los libros que faltan.
- **La IA, contada con honestidad:** hoy está en cómo se diseñó y se construyó el producto y su mensaje. En el producto, HALO como asistente que recomiende lecturas y avise vencimientos es la **próxima fase**; no se presenta como algo ya construido.
- **Rúbrica:** claridad 5 · diferenciación 4 · emoción 4 · credibilidad 4 · llamado a la acción 3. Justificación del llamado a la acción: «Agenda una demo» sigue siendo genérico, porque no hay una cifra ni un plazo.

---

## Ronda 3 · Simulación del jurado (red teaming)

> «Ahora actúa como el jurado más exigente del Desafío Naranja. Ataca la propuesta con las 3 preguntas más difíciles que harías. Luego reescribe el pitch para que las responda antes de que se las hagan, usando solo datos reales del contexto. Cierra pidiendo 5 bibliotecas piloto.»

### Preguntas del jurado
1. **¿Por qué una biblioteca los elegiría a ustedes y no un sistema gratuito o extranjero?**
2. **Si el equipo es una sola persona, ¿quién da el soporte cuando algo falla?**
3. **¿Qué pruebas tienen de que pueden entregar?**

### Resultado final
El resultado final es el que aparece en la sección 4C del entregable: la ficha, la PUV, el pitch de 5 escenas y la rúbrica corregida (claridad 5 · diferenciación 4 · emoción 4 · credibilidad 4 · llamado a la acción 5).
