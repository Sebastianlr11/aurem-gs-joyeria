/**
 * Lo que la tienda pública le pregunta a la base, sin `supabase-js`.
 *
 * Aquí viven las lecturas de una pieza suelta, del abono de envío y de un
 * pedido ya pagado, más la llamada a `create-preference`. La lista del
 * catálogo NO está acá: la sirve `piezasPublicadas.js`, que la pide una sola
 * vez por pestaña y la comparten la portada, `/catalogo` y —desde hoy— las
 * piezas relacionadas de la ficha.
 *
 * ── Por qué a mano y no con el cliente de la librería ───────────────────
 *
 * Son 46 KiB comprimidos —el informe del 30 de agosto de 2026 dice que 36 no
 * se usan— con Auth, Realtime y Storage dentro, para hacer un GET. Y el peso
 * es lo de menos: era **un eslabón más en la cadena**. En la ficha la foto de
 * la pieza no empezaba a bajar hasta el segundo 1, con este camino en serie:
 *
 *     HTML 172 ms → index.js 330 ms → chunk de supabase 425 ms → pieza 881 ms → foto
 *
 * El panel sigue con el cliente completo, que allá sí hace falta: sesión,
 * suscripciones en vivo y subida de fotos.
 *
 * ── Por qué devuelve `{ data, error }` ─────────────────────────────────
 *
 * Porque es la forma que ya tenían las llamadas que reemplaza, y así el
 * cambio se lee en el diff como lo que es —de dónde salen los datos— y no
 * como una reescritura de cada pantalla.
 *
 * ── La llave ───────────────────────────────────────────────────────────
 *
 * `VITE_SUPABASE_ANON_KEY` es pública: todo lo que empieza por `VITE_` acaba
 * dentro del bundle y cualquiera lo ve. Lo que decide qué se puede leer es
 * RLS, no el secreto de la llave.
 */

const URL_BASE = import.meta.env.VITE_SUPABASE_URL
const CLAVE = import.meta.env.VITE_SUPABASE_ANON_KEY

const cabeceras = {
  apikey: CLAVE,
  Authorization: `Bearer ${CLAVE}`,
}

/* Las columnas se nombran, nunca `select=*`.

   `products` tiene `costo` y `costo_provisional`, y ésta es una lectura con
   la llave pública: hasta el 30 de agosto de 2026 la ficha pedía `*` y
   **publicaba lo que le cuesta cada pieza al taller** a quien abriera la
   pestaña de red. Es el mismo agujero que se cerró en el catálogo, por la
   puerta de al lado.

   Ésta sí trae `images` —la galería entera— y `description`, que la rejilla
   del catálogo no necesita. Por eso es otra consulta y no la misma.

   Está escrita DOS veces: aquí y en el `<script>` de `index.html` que la
   adelanta. No hay forma de compartir una constante entre el HTML y el
   bundle, así que las compara `apiPublica.test.js` y el build se cae si
   dejan de coincidir. **Si tocas una, toca la otra.** */
export const COLUMNAS_DE_PIEZA =
  'id,name,category,description,price,compare_price,image_url,images,' +
  'metal,piedra,talla_rango,stock,is_new,is_featured'

/**
 * Un GET a la API REST.
 *
 * Nunca lanza: devuelve el error dentro del objeto, como hacía `supabase-js`.
 * Una pantalla de tienda que revienta por una consulta caída es peor que una
 * que dice que no pudo cargar.
 */
async function leer(consulta) {
  try {
    const res = await fetch(`${URL_BASE}/rest/v1/${consulta}`, { headers: cabeceras })
    if (!res.ok) {
      const cuerpo = await res.json().catch(() => null)
      return { data: null, error: { message: cuerpo?.message || `Supabase respondió ${res.status}` } }
    }
    return { data: await res.json(), error: null }
  } catch (err) {
    return { data: null, error: { message: err?.message || 'Sin conexión' } }
  }
}

/** Lo mismo, quedándose con la primera fila —o `null` si no vino ninguna—. */
async function leerUna(consulta) {
  const { data, error } = await leer(consulta)
  if (error) return { data: null, error }
  return { data: (Array.isArray(data) && data[0]) || null, error: null }
}

/**
 * Una pieza, por su id.
 *
 * Si la visita entró directamente a `/catalogo/<id>` —que es como llega quien
 * abre el enlace desde WhatsApp—, `index.html` ya lanzó esta misma consulta
 * antes de bajar una línea de JavaScript, y lo único que hay que hacer es
 * colgarse de esa promesa en vez de abrir otra.
 *
 * El adelanto se consume UNA vez: volver a la ficha desde el catálogo, media
 * hora después, tiene que preguntar de nuevo y no enseñar el precio de cuando
 * se abrió la pestaña.
 */
export async function traerPieza(id) {
  const adelanto = typeof window !== 'undefined' ? window.__pieza : null

  if (adelanto && adelanto.id === id) {
    delete window.__pieza
    const pieza = await adelanto.promesa
    /* Si el adelanto no trajo nada —red caída, o la pieza no existe— se
       pregunta por el camino normal. Vale más una consulta repetida que una
       ficha que dice "no encontrada" por un fallo de red. */
    if (pieza) return { data: pieza, error: null }
  }

  return leerUna(`products?select=${COLUMNAS_DE_PIEZA}&id=eq.${encodeURIComponent(id)}`)
}

/**
 * Cuánto se abona por el envío y hasta cuánto se despacha contraentrega.
 *
 * De la vista `envio_publico` y no de `taller_precios`, que tiene RLS
 * restringido: ahí está el recargo, que es el margen del negocio.
 */
export function traerEnvioPublico() {
  return leerUna('envio_publico?select=abono_envio,tope_contraentrega')
}

/** Los datos de un pedido que se pueden enseñar en la pantalla de gracias. */
export async function traerPedidoPublico(id) {
  try {
    const res = await fetch(`${URL_BASE}/rest/v1/rpc/pedido_publico`, {
      method: 'POST',
      headers: { ...cabeceras, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_id: id }),
    })
    if (!res.ok) return { data: null, error: { message: `Supabase respondió ${res.status}` } }
    const cuerpo = await res.json()
    /* La RPC devuelve una fila; PostgREST la manda como lista o como objeto
       según cómo esté declarada, y las dos formas valen. */
    return { data: (Array.isArray(cuerpo) ? cuerpo[0] : cuerpo) || null, error: null }
  } catch (err) {
    return { data: null, error: { message: err?.message || 'Sin conexión' } }
  }
}

/**
 * Llamar a una Edge Function pública.
 *
 * Reemplaza a `supabase.functions.invoke`, que era lo último que ataba la
 * ficha al cliente completo. Y de paso dice la verdad cuando algo falla: el
 * `invoke` contestaba "Edge Function returned a non-2xx status code" y se
 * tragaba el mensaje del cuerpo, que es el que explica el porqué —"Alguna
 * pieza ya no está disponible", "contraentrega_no_disponible"—.
 */
export async function llamarFuncion(nombre, cuerpo) {
  try {
    const res = await fetch(`${URL_BASE}/functions/v1/${nombre}`, {
      method: 'POST',
      headers: { ...cabeceras, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    })
    const datos = await res.json().catch(() => null)
    if (!res.ok) {
      return { data: datos, error: { message: datos?.error || `La función respondió ${res.status}` } }
    }
    return { data: datos, error: null }
  } catch (err) {
    return { data: null, error: { message: err?.message || 'Sin conexión' } }
  }
}
