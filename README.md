# Aurem Gs Joyería

Joyería de oro y plata en Bogotá. Piezas de catálogo y fabricación a medida.

Esto es el sistema completo del negocio: la tienda pública, el panel de administración,
**"Valentina"** —el bot que atiende WhatsApp—, los cobros por Mercado Pago, los correos
transaccionales y un vigía que avisa por correo cuando algo se rompe.

**El motor comercial es WhatsApp, no la web.** La mayoría de los pedidos entran
conversando; la web es vitrina, prueba de que la tienda existe, y checkout para quien
prefiere pagar solo.

---

## Qué hace

**Tienda**
- Catálogo con filtros por categoría, precio y material
- Ficha de pieza con galería, punzón de ley, guía de tallas y compra directa
- **Dos formas de pago**: en línea con Mercado Pago (2% de descuento) o **contraentrega con
  abono** — se abona el envío para confirmar y se paga el resto en la puerta
- Guía de tallas con calculadora real
- Páginas legales

**Valentina, en WhatsApp**
- Responde con el catálogo real, no con lo que se imagine
- Entiende **fotos y notas de voz**
- Cotiza piezas a medida con el precio del oro del día
- Arma pedidos completos y cobra
- **Escala a una persona** cuando algo se sale de lo que sabe

**Panel** (`/admin`)
- Qué hay que atender hoy y cuánta plata entró **de verdad** (descontando comisiones, y sin
  contar como cobrado lo que todavía está en el bolsillo del cliente)
- Catálogo, pedidos, clientes y despachos
- Panel de conversaciones en tiempo real, con toma de control
- Reportes y retorno de pauta con el IVA incluido
- Precio del oro y base de conocimiento de Valentina, editables sin desplegar

---

## Stack

| | |
|---|---|
| **Frontend** | React 19, Vite 7, react-router 7, TypeScript (modo estricto) |
| **Estilos** | **CSS plano, escrito a mano, en diez archivos** — `index.css` y `panel.css` más siete hojas que sólo se cargan con su pantalla. Sin Tailwind, sin CSS modules, sin preprocesador |
| **Animaciones** | `src/lib/aparecer.js` propio. **Sin Framer Motion** |
| **Datos y auth** | Supabase — Postgres, Auth, Storage, Realtime |
| **Backend** | 12 Edge Functions de Supabase (Deno) + 2 endpoints serverless en Vercel |
| **Pagos** | Mercado Pago |
| **Mensajería** | WhatsApp Cloud API (Meta) |
| **Envíos** | 99envios — cotizar y emitir guías con cinco transportadoras |
| **IA** | OpenRouter |
| **Correos** | Resend + React Email |
| **Hosting** | Vercel |

> **El backend no está en `api/`.** Son 2 endpoints (221 líneas) frente a ~6.500 líneas de
> Edge Functions en `supabase/functions/`.

> **Y la portada no la pinta el navegador.** `npm run build` la deja hecha dentro de
> `dist/index.html`, con la hoja de estilos adentro; las demás rutas se sirven desde
> `dist/app.html`, que va vacío. Ver [`docs/specs/diseno-y-frontend.md`](docs/specs/diseno-y-frontend.md).

---

## Estructura

```
src/
├── pages/           Tienda pública (9 rutas, la 404 incluida) + admin/
│   ├── *.css        Seis hojas que sólo se cargan con su pantalla
│   └── admin/       Dashboard (contenedor) + secciones/ (8 pantallas)
│                    + ChatPanel y chat/ (17 archivos)
├── components/      Componentes de la tienda + catalog/
├── lib/             supabase, apiPublica, dinero, caja, circuito, talla,
│                    atribucion, pixeles, meta, whatsapp, portada, envio,
│                    aparecer, optimizarFoto, fotoProducto, tituloPieza
├── entrada-servidor.jsx  La app pintada en Node, sólo para el build
├── index.css        El sistema de diseño, la portada y lo compartido (2.899 l.)
├── panel.css        El panel (7.885 l.)
└── fuentes.css      Marcellus y Mulish, autoalojadas

supabase/
├── functions/       wa-webhook, wa-send, create-preference, mp-webhook,
│                    conversion-pedido, correo-despacho, vigilancia,
│                    plantillas-programadas, create-admin, redactar-pieza,
│                    cotizar-envio, crear-guia          (12 funciones)
│   └── _shared/     bot.ts (Valentina), bucle.ts, reglas.ts, redaccion.ts,
│                    wa.ts, medios.ts, conversiones.ts, envios.ts, pedidos.ts
└── migrations/      44 archivos: la base entera se reconstruye desde aquí

api/                 ficha.js (previsualizaciones), correo.js (Resend)
emails/              4 plantillas de React Email + la marca compartida
scripts/             sitemap, correos, prerenderizar, imagenes, css-pisadas,
                     css-de-quien-es, css-mudanza, huella-estilos
docs/                Documentación por feature  ← empieza aquí
```

---

## Puesta en marcha

```bash
git clone https://github.com/Sebastianlr11/aurem-gs-joyeria.git
cd aurem-gs-joyeria
npm install
```

Crea un `.env.local` en la raíz:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_MP_PUBLIC_KEY=
CORREO_SECRETO=
RESEND_API_KEY=
RESEND_EMAIL_DOMAIN=
```

Los secretos de las Edge Functions (WhatsApp, Mercado Pago, OpenRouter, Meta, TikTok) viven
en Supabase, no aquí. La lista completa está en [`CLAUDE.md`](CLAUDE.md).

```bash
npm run dev
```

### Comandos

```bash
npm run dev          # Vite en http://localhost:5173
npm run build        # lint + pruebas + sitemap + correos + tsc + vite build + prerenderizar
npm run lint         # ESLint (sí corre en el build, y lo tumba)
npm run preview      # Sirve /dist

npm run email        # Previsualizador de correos en :3010
npm run imagenes     # Convierte las fotos estáticas a WebP
npm run css:pisadas  # Detecta reglas CSS que otras pisan
npm run prerenderizar # Pinta la portada en Node y la mete en dist/index.html
npm run sitemap      # Regenera public/sitemap.xml
npm test             # Vitest, una pasada (303 pruebas)
npm run test:mirar   # Vitest en marcha, repitiendo al guardar
```

---

## Documentación

| Documento | Para qué |
|---|---|
| [**CLAUDE.md**](CLAUDE.md) | El mapa completo: arquitectura, rutas, modelo de datos, reglas de negocio, convenciones |
| [**docs/specs/**](docs/specs/README.md) | Un documento por feature — 21 en total |
| [**docs/pendientes.md**](docs/pendientes.md) | Los 41 hallazgos de la revisión, todos cerrados, con qué pasaba y por qué se decidió lo que se decidió |
| [**DESIGN.md**](DESIGN.md) | El sistema de diseño de la tienda. **Fuente de verdad** de colores y tipografía |
| [**DESIGN-PANEL.md**](DESIGN-PANEL.md) | El del panel: hereda la identidad y cambia lo que la densidad obliga |

> Antes de tocar producción, lee [`docs/pendientes.md`](docs/pendientes.md). A 23 de agosto
> de 2026 los 41 hallazgos están cerrados —los de seguridad incluidos— y **la base entera se
> reconstruye desde el repositorio**: las 17 tablas, las 8 RPC, las políticas y los dos
> trabajos del cron.

---

## Convenciones

- **Todo en español de Colombia**: código, comentarios, interfaz, ramas y commits.
- Ramas `feat/`, `fix/`, `perf/`, `chore/`, `revert/`, `docs/` + frase descriptiva
  (`fix/dashboard-decia-lo-que-no-sabia`).
- **El mensaje de commit describe el efecto para el negocio**, no el cambio técnico.
- Los comentarios del código explican **el incidente que motivó cada decisión no obvia**.
  Mantener esa costumbre.

---

## Licencia

MIT
