import { useEffect, useState } from 'react'

/**
 * El catálogo, para todo el sitio público: las dos secciones de la portada
 * que lo enseñan y la rejilla de `/catalogo`.
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

/* Las columnas se nombran, nunca `select=*`.

   Dos razones. La de peso: `products` tiene `costo` y `costo_provisional`, y
   ésta es una lectura con la llave pública — hasta el 30 de agosto de 2026 el
   catálogo pedía `*` y **publicaba el costo de cada pieza a quien abriera la
   pestaña de red**. La otra: `images[]` es la galería entera de la ficha, y
   una rejilla que enseña una foto por pieza no la necesita.

   Es la unión de lo que piden las tres pantallas, no la lista mínima de
   ninguna: la portada no usa `price` ni `description`, y los baja igual. Sale
   a cuenta porque así hay UNA consulta en todo el sitio y no dos — ver abajo.
   `description` cabe en 180 caracteres por la regla de las fichas, así que lo
   que suma son ~1,5 KB comprimidos en la portada. */
const CONSULTA =
  'select=id,name,category,metal,piedra,image_url,stock,is_featured,is_new,' +
  'price,compare_price,description,created_at&order=created_at.desc'

let enCurso = null

/**
 * La consulta, una sola por pestaña, con la marca de si llegó o no.
 *
 * Resuelve `{ piezas, fallo }` y **nunca rechaza**. El `fallo` va aparte
 * porque las dos pantallas necesitan cosas distintas de él: a la portada le
 * da igual —una sección sin tarjetas se calla y el resto de la página sigue
 * en pie—, pero el catálogo tiene que decir "no pudimos cargar" y no
 * "estamos surtiendo": con un corte de red le anunciaría a la clienta que no
 * hay inventario.
 */
function traer() {
  /* La promesa se guarda, no el resultado: si la segunda sección pregunta
     mientras la primera espera, se cuelga de la misma respuesta.

     Se guarda para toda la vida de la pestaña. La portada no es una pantalla
     que se quede abierta esperando novedades, y quien vuelva a ella desde el
     catálogo prefiere que no parpadee a que le enseñe la pieza que se subió
     hace treinta segundos. */
  /* La llave en la URL y ni una cabecera propia: así el GET es una petición
     «simple» y el navegador no manda el OPTIONS de preflight por delante.
     Medido el 30 de agosto de 2026 en producción, ese preflight eran 261 ms
     esperando permiso para recién entonces pedir el catálogo. Ver el
     comentario largo en `apiPublica.js`. */
  enCurso ??= fetch(`${URL_BASE}/rest/v1/products?${CONSULTA}&apikey=${CLAVE}`)
    .then((res) => {
      if (!res.ok) throw new Error(`Supabase respondió ${res.status}`)
      return res.json()
    })
    .then((piezas) => ({ piezas: piezas || [], fallo: false }))
    .catch(() => ({ piezas: [], fallo: true }))

  return enCurso
}

/** La lista, sin más. Es lo que usan las dos secciones de la portada. */
export function piezasPublicadas() {
  return traer().then(({ piezas }) => piezas)
}

/* La pregunta sale al evaluar el módulo, no al montar el componente.

   Es el mismo motivo por el que `capturarClic()` e `iniciarPixeles()` corren a
   nivel de módulo en App.jsx. Dentro del efecto, la consulta esperaba a que
   React montara el árbol entero de la portada; acá sale en cuanto corre el
   bundle, y para cuando la portada esté pintada la respuesta ya viene en
   camino. Con el preconnect de index.html, además, sin pagar el saludo.

   `traer()` se guarda la promesa, así que los ganchos de abajo se cuelgan de
   ésta y no disparan una segunda. Eso es también lo que arregló que
   `/catalogo` preguntara DOS veces por la misma tabla: la portada va estática
   en `App.jsx`, así que este módulo se evalúa en todas las rutas y esta
   consulta salía igual; el catálogo hacía la suya aparte, con el cliente de
   Supabase, y encima esperaba a que bajara su propio chunk para empezarla.

   La guarda de `window` es para que importar este archivo desde Node —una
   prueba, un script del build— no intente salir a la red. */
if (typeof window !== 'undefined') traer()

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

/**
 * El mismo catálogo, para `/catalogo`.
 *
 * Existe aparte de `usePiezasPublicadas` porque la rejilla necesita
 * distinguir tres estados y no dos: mientras carga enseña esqueletos, si
 * llegó vacío dice que se está surtiendo, y si no llegó dice que recargue.
 *
 * @returns {{piezas: object[], cargando: boolean, fallo: boolean}}
 */
export function useCatalogoPublico() {
  const [estado, setEstado] = useState({ piezas: [], cargando: true, fallo: false })

  useEffect(() => {
    let vivo = true
    traer().then(({ piezas, fallo }) => {
      if (vivo) setEstado({ piezas, cargando: false, fallo })
    })
    return () => { vivo = false }
  }, [])

  return estado
}
