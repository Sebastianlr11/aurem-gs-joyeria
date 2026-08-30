import { createRoot, hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

const raiz = document.getElementById('root')!

const app = (
  <BrowserRouter>
    <App />
  </BrowserRouter>
)

/* Hidratar si el HTML ya viene pintado, montar desde cero si no.
 *
 * `scripts/prerenderizar.mjs` deja la portada pintada dentro de `#root` en el
 * build, así que en `/` la joya está en pantalla antes de que este archivo
 * exista. Ahí React no tiene que construir nada: sólo engancharse a lo que ya
 * hay. Las demás rutas se sirven desde `app.html`, que trae el `#root` vacío,
 * y siguen montando como siempre.
 *
 * La distinción es por lo que hay en el contenedor y no por la ruta a
 * propósito: si algún día se prerenderiza otra pantalla, esto ya funciona; y
 * si el prerenderizado falla y el HTML sale vacío, el sitio se monta solo en
 * el navegador en vez de quedarse en blanco.
 */
if (raiz.firstChild) hydrateRoot(raiz, app)
else createRoot(raiz).render(app)
