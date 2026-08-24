# Specs de Aurem Gs Joyería

Un documento por feature. Cada uno responde lo mismo: **qué resuelve**, **cómo funciona
hoy** (flujo, archivos, tablas, variables de entorno), **qué se decidió y por qué**, **qué
límites tiene** y **cómo probarlo**.

Están conciliados con el código del **23 de agosto de 2026**. Las decisiones no son
invención: casi todas salen de los comentarios del propio código, que documentan el
incidente que las motivó.

> **Ya no se citan números de línea.** Se citaban, y el 23 de agosto `Dashboard.jsx` pasó
> de 4.100 líneas a 248 y `ChatPanel.jsx` se partió en doce archivos: **más de cien
> referencias quedaron apuntando a sitios que ya no existen**, todas a la vez y sin que
> nada fallara. Una referencia falsa manda a buscar donde no está, que es peor que no
> tener ninguna. Se nombran archivos y funciones, que sobreviven a un reordenamiento.

> Para el mapa general del proyecto, empieza por [`CLAUDE.md`](../../CLAUDE.md).
> Para el historial de lo que estaba roto y cómo se cerró, [`pendientes.md`](../pendientes.md).

---

## Tienda pública

| Spec | Qué resuelve | Estado |
|---|---|---|
| [landing.md](landing.md) | La portada: convencer de que la tienda es real y llevar a WhatsApp o al catálogo | En producción |
| [catalogo.md](catalogo.md) | Ver y filtrar todas las piezas | En producción |
| [ficha-producto.md](ficha-producto.md) | La pantalla donde se decide la compra | En producción |
| [checkout-y-pagos.md](checkout-y-pagos.md) | Cobrar: Mercado Pago y contraentrega con abono | En producción |
| [paginas-de-contenido.md](paginas-de-contenido.md) | Políticas legales y guía de tallas | En producción |

## WhatsApp y Valentina

| Spec | Qué resuelve | Estado |
|---|---|---|
| [chatbot-valentina.md](chatbot-valentina.md) | Atender, cotizar y vender por WhatsApp sin una persona delante | En producción |
| [whatsapp-envio-y-plantillas.md](whatsapp-envio-y-plantillas.md) | Hablarle a un cliente: mensajes naturales, ventana de 24 h, plantillas | En producción · encendidas desde el 22 de agosto |

## Panel de administración

| Spec | Qué resuelve | Estado |
|---|---|---|
| [admin-acceso.md](admin-acceso.md) | Entrar al panel y gestionar quién más entra | En producción |
| [admin-dashboard.md](admin-dashboard.md) | Saber en 10 segundos qué hay que atender hoy y cuánta plata entró | En producción |
| [admin-catalogo.md](admin-catalogo.md) | Publicar, editar y retirar piezas | En producción |
| [admin-pedidos.md](admin-pedidos.md) | Llevar un pedido de confirmado a entregado | En producción |
| [admin-chat.md](admin-chat.md) | Leer los chats de Valentina y tomar el control cuando toca | En producción |
| [admin-reportes-y-pauta.md](admin-reportes-y-pauta.md) | Saber si la pauta se está pagando sola | En producción |
| [admin-ajustes.md](admin-ajustes.md) | Precio del oro, conocimiento de Valentina, administradores | En producción |

## Transversales

| Spec | Qué resuelve | Estado |
|---|---|---|
| [modelo-de-datos.md](modelo-de-datos.md) | Qué hay en la base y qué está versionado | Las 16 tablas versionadas · 5 RPC de analítica, no |
| [correos.md](correos.md) | Correos transaccionales con Resend | En producción |
| [atribucion-y-pixeles.md](atribucion-y-pixeles.md) | Saber qué anuncio trajo cada venta | En producción |
| [seo-y-compartir.md](seo-y-compartir.md) | Que Google indexe y que WhatsApp muestre la foto al compartir | En producción |
| [vigilancia.md](vigilancia.md) | Enterarse de que algo se rompió sin mirar el panel | En producción |
| [envios-99envios.md](envios-99envios.md) | Cotizar el envío y pedir la guía a las cinco transportadoras | Fase 2 · sin estrenar |
| [diseno-y-frontend.md](diseno-y-frontend.md) | CSS, fuentes, animaciones y la relación con DESIGN.md | En producción · de 143 bloques pisados a 4 |

---

## Cómo mantener esto

- **Un cambio de feature actualiza su spec en el mismo commit.** Si no, esto se convierte
  en lo que era `CLAUDE.md` antes del 22 de agosto: un documento que miente con confianza.
- **Los números envejecen.** Si abres un spec y un recuento de líneas no cuadra, arréglalo
  de paso. Y no vuelvas a meter `archivo.js:123`: no sobrevive al siguiente reordenamiento.
- **Lo que no se puede deducir del código es lo valioso.** El flujo se lee en los
  archivos; el *porqué* sólo está aquí y en los comentarios.
