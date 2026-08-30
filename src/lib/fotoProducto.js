/**
 * Una foto de catálogo, del tamaño que hace falta.
 *
 * El transformador de imágenes de Supabase Storage —el `?width=` que habría
 * resuelto esto en una línea— **es de plan Pro**. Comprobado contra el
 * proyecto el 23 de agosto de 2026: `/storage/v1/render/image/...` responde
 * 403 `FeatureNotEnabled`. Así que los tamaños se generan al subir la foto,
 * en `optimizarFoto.js`, y aquí sólo se arman las URLs.
 *
 * Cómo se sabe qué tamaños existen, sin tocar la base de datos: **el nombre
 * del archivo lo dice**. Una foto subida con el tratamiento completo termina
 * en `-<ancho>x<alto>.webp`, y a su lado viven `-w400.webp` y `-w800.webp`.
 * Una foto vieja —o una URL pegada a mano en el panel— no lleva esa marca, y
 * entonces esta función devuelve la URL sola, sin `srcset`. Eso importa: un
 * `srcset` inventado apuntaría a archivos que no existen y el navegador
 * mostraría una foto rota, que es mucho peor que una foto pesada.
 */

/* La escalera. Cambiar esta lista obliga a resubir las fotos: las que ya
   están en Storage se generaron con estos anchos y con ningún otro. */
export const ANCHOS = [400, 800]

/* Cuánto ocupa en pantalla la foto grande de la ficha.

   Vive acá y no suelto en el JSX porque **está escrito dos veces**: el `<img>`
   de la ficha lo usa, y el `<script>` de `index.html` lo repite para adelantar
   la descarga de esa misma foto antes de que exista el `<img>`. Si los dos
   dejan de decir lo mismo, el navegador elige un archivo para la precarga y
   otro para pintar, y **se baja la foto dos veces** — sin que se note nada, ni
   en pantalla ni en el build. Los compara `fotoProducto.test.js`. */
export const TAMANOS_FICHA = '(max-width: 900px) 100vw, 55vw'

/* `-893x1600.webp` al final del nombre. Los dos números son el tamaño real
   del archivo grande, y sirven para reservarle el sitio al <img>. */
const MARCA = /-(\d+)x(\d+)\.webp$/

/**
 * @param {string} url  la que está guardada en `products.image_url` o `images[]`
 * @param {{conMedidas?: boolean}} opciones
 *   `conMedidas: false` para el visor a pantalla completa, donde el CSS
 *   limita la foto por alto y por ancho a la vez: con `width` y `height`
 *   puestos el navegador deja de ajustar el ancho y la foto queda nadando
 *   dentro de una caja de 893px.
 * @returns props para pasarle tal cual a un <img> con el operador de reparto.
 */
export function fotoProducto(url, { conMedidas = true } = {}) {
  const marca = MARCA.exec(url || '')
  if (!marca) return { src: url }

  const ancho = Number(marca[1])
  const alto = Number(marca[2])
  const base = url.slice(0, -marca[0].length)

  const juego = ANCHOS.filter((a) => a < ancho).map((a) => `${base}-w${a}.webp ${a}w`)
  juego.push(`${url} ${ancho}w`)

  const props = { src: url, srcSet: juego.join(', ') }
  if (conMedidas) { props.width = ancho; props.height = alto }
  return props
}
