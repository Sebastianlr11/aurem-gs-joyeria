/**
 * La misma app, pintada en Node.
 *
 * Existe para una sola cosa: que `scripts/prerenderizar.mjs` pueda dejar la
 * portada ya pintada dentro del HTML que sirve Vercel. No corre en el
 * navegador ni entra en ningún bundle público — Vite la compila aparte, con
 * `vite build --ssr`, a `dist-servidor/`.
 *
 * Por qué existe todo esto está medido en `scripts/prerenderizar.mjs`.
 *
 * `StaticRouter` y no `BrowserRouter` porque en Node no hay barra de
 * direcciones: la ruta se pasa a mano.
 */
/* eslint-disable react-refresh/only-export-components -- Este archivo no
   corre en el navegador ni pasa por Fast Refresh: es la entrada de la
   compilación de servidor, y exporta a propósito lo que el build necesita
   además de `pintar`. */
import { renderToString } from 'react-dom/server'
/* `prerender` —de `react-dom/static`, no de `/server`— ESPERA a que resuelvan
   los `lazy()` y los Suspense antes de devolver el HTML. `renderToString` no:
   con una página perezosa pinta el cargador y sigue. La portada no lo
   necesita porque `Home` no es perezoso; el catálogo sí lo es. */
import { prerender } from 'react-dom/static'
/* De `react-router-dom` a secas: en la v7 no hay subruta `/server`, todo
   sale del mismo paquete. */
import { StaticRouter } from 'react-router-dom'
import App from './App.jsx'

/* Lo que `scripts/prerenderizar.mjs` necesita para pintar el catálogo, sale
   de acá y no importándolo de `src/lib/` directamente: `piezasPublicadas.js`
   lee `import.meta.env` al cargarse, que en Node pelado no existe. Vite lo
   sustituye en esta compilación, así que por aquí llega ya resuelto. */
export { sembrar, CONSULTA } from './lib/piezasPublicadas.js'
export { fotoProducto, TAMANOS_TARJETA } from './lib/fotoProducto.js'
export { META_CATALOGO } from './lib/meta.js'
export const SUPABASE = {
  url: import.meta.env.VITE_SUPABASE_URL,
  clave: import.meta.env.VITE_SUPABASE_ANON_KEY,
}

/** El HTML de una ruta, tal como lo pintaría React en el primer render. */
export function pintar(ruta) {
  return renderToString(
    <StaticRouter location={ruta}>
      <App />
    </StaticRouter>
  )
}

/**
 * Lo mismo, para una ruta con `lazy()` adentro. Los datos que la pantalla
 * necesite tienen que estar sembrados antes —ver `sembrar()` en
 * `src/lib/piezasPublicadas.js`—: acá no hay red.
 */
export async function pintarConDatos(ruta) {
  const unaVez = async () => {
    const { prelude } = await prerender(
      <StaticRouter location={ruta}>
        <App />
      </StaticRouter>
    )
    return await new Response(prelude).text()
  }

  /* `prerender` sólo para CALENTAR el `lazy()`, y el HTML de verdad sale de
     `renderToString`, como el de la portada. Por qué así, en dos pasos:

     - `renderToString` no espera a un `lazy()`: con el módulo sin resolver
       pinta el cargador del Suspense y sigue. Por eso el primer paso.
     - Pero `prerender` no sirve para el HTML final: React lo escribe con un
       Suspense grande como contenido TARDÍO —un `<div hidden id="S:0">` con
       un `<template>` de cargador en su sitio y un `$RC(...)` que lo revela
       en el siguiente `requestAnimationFrame`—. En un HTML estático eso es
       tres cosas malas a la vez: el cargador se pinta primero y se cambia
       después (layout shift), el LCP espera a ese frame, y en una pestaña de
       fondo —donde rAF no corre— el catálogo no aparece ni se hidrata nunca.
       Se vio el 7 de septiembre de 2026 probando en local.

     Con el módulo ya resuelto —React se lo guarda en el propio `lazy()`—,
     `renderToString` pinta la página en línea, dentro de un `<!--$-->…<!--/$-->`
     completo, como cualquier otra. `scripts/prerenderizar.mjs` comprueba que
     no quede ninguna instrucción de revelado. */
  await unaVez()
  return pintar(ruta)
}
