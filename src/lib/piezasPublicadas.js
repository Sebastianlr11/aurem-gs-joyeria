import { useEffect, useState } from 'react'

/**
 * El catálogo, para las dos secciones de la portada que lo enseñan.
 *
 * Se pregunta con un `fetch` pelado al REST de Supabase y **no con el cliente
 * de la librería**, que es lo que usa el resto del sitio. La razón son 46 KB
 * comprimidos: la portada no cargaba ese paquete —lo cargan el catálogo, la
 * ficha y el panel— y traerlo entero para enseñar unas fotos sería deshacer lo
 * que se ganó sacando Framer Motion. La llave anónima y la URL ya viajan en el
 * bundle público, y es la misma lectura pública que hace el catálogo.
 *
 * **La consulta se hace una sola vez aunque la pidan dos secciones.** Las
 * colecciones y el carrusel montan a la vez y con dos `fetch` la portada haría
 * dos veces la misma pregunta.
 */

const URL_BASE = import.meta.env.VITE_SUPABASE_URL
const CLAVE = import.meta.env.VITE_SUPABASE_ANON_KEY

/* Sólo las columnas que las tarjetas usan: no se baja el catálogo entero con
   descripciones para enseñar ocho fotos. */
const CONSULTA =
  'select=id,name,category,metal,image_url,stock,is_featured,created_at&order=created_at.desc'

let enCurso = null

export function piezasPublicadas() {
  /* La promesa se guarda, no el resultado: si la segunda sección pregunta
     mientras la primera espera, se cuelga de la misma respuesta.

     Se guarda para toda la vida de la pestaña. La portada no es una pantalla
     que se quede abierta esperando novedades, y quien vuelva a ella desde el
     catálogo prefiere que no parpadee a que le enseñe la pieza que se subió
     hace treinta segundos. */
  enCurso ??= fetch(`${URL_BASE}/rest/v1/products?${CONSULTA}`, {
    headers: { apikey: CLAVE, Authorization: `Bearer ${CLAVE}` },
  })
    .then((res) => {
      if (!res.ok) throw new Error(`Supabase respondió ${res.status}`)
      return res.json()
    })
    /* Que falle la red no pinta un error en la portada: las secciones que
       dependen de esto se guardan sus tarjetas y el resto de la página sigue
       en pie. Por eso devuelve una lista vacía y no rechaza. */
    .catch(() => [])

  return enCurso
}

/* La pregunta sale al evaluar el módulo, no al montar el componente.

   Es el mismo motivo por el que `capturarClic()` e `iniciarPixeles()` corren a
   nivel de módulo en App.jsx. Dentro del efecto, la consulta esperaba a que
   React montara el árbol entero de la portada; acá sale en cuanto corre el
   bundle, y para cuando la portada esté pintada la respuesta ya viene en
   camino. Con el preconnect de index.html, además, sin pagar el saludo.

   `piezasPublicadas()` se guarda la promesa, así que el gancho de abajo se
   cuelga de ésta y no dispara una segunda.

   La guarda de `window` es para que importar este archivo desde Node —una
   prueba, un script del build— no intente salir a la red. */
if (typeof window !== 'undefined') piezasPublicadas()

/**
 * @returns `null` mientras carga, y la lista —quizá vacía— cuando llega.
 */
export function usePiezasPublicadas() {
  const [piezas, setPiezas] = useState(null)

  useEffect(() => {
    let vivo = true
    piezasPublicadas().then((p) => { if (vivo) setPiezas(p) })
    return () => { vivo = false }
  }, [])

  return piezas
}
