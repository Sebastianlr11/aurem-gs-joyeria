# La imagen que sale al compartir

`public/assets/og-compartir.jpg` — 1200×630, que es lo que esperan WhatsApp,
Facebook e Instagram. No es una foto suelta: es una tarjeta con la marca, una
frase y la pieza, porque en una vista previa de WhatsApp una foto sin contexto
no dice de quién es.

La anterior era `pen-hero.jpg`, vertical de 928×1152. Las plataformas la
recortaban por el centro, así que cada vez que alguien compartía el sitio
—y WhatsApp es el canal principal— salía una tira de una foto, sin marca.

## Cómo se regenera

`tarjeta.html` es la fuente. Para rehacerla:

1. Servirla: copiarla a `public/` temporalmente y `npm run dev`.
2. Abrirla en Chrome y medir dónde queda `.tarjeta` — está centrada en la
   ventana a propósito, para que un recorte centrado caiga exacto encima.
3. Capturar, y con `sips` recortar centrado y escalar a 1200×630.

La foto es la del Anillo Majestuosa, del bucket `product-images`. Se eligió
por el fondo negro, que funde con el cacao de la marca sin que se note la
costura, y porque es una pieza real: mezclar fotos de banco con producto
propio rompe la confianza, y el sistema de diseño lo prohíbe.

Si algún día se cambia la pieza, revisar que la frase siga siendo cierta
para ella.
