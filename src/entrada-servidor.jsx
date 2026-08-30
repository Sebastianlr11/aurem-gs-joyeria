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
import { renderToString } from 'react-dom/server'
/* De `react-router-dom` a secas: en la v7 no hay subruta `/server`, todo
   sale del mismo paquete. */
import { StaticRouter } from 'react-router-dom'
import App from './App.jsx'

/** El HTML de una ruta, tal como lo pintaría React en el primer render. */
export function pintar(ruta) {
  return renderToString(
    <StaticRouter location={ruta}>
      <App />
    </StaticRouter>
  )
}
