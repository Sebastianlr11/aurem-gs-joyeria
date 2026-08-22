/**
 * Achica y convierte una foto antes de subirla.
 *
 * Las fotos del catálogo las sube el joyero desde el panel, y salen del
 * celular: 1536×2752 y más de un megabyte cada una. Se guardaban tal cual, y
 * eso es exactamente lo que baja después cada clienta que abre la ficha.
 *
 * Se hace en el navegador y no en el servidor por dos razones. La primera es
 * que no hace falta nada más: el navegador ya sabe redimensionar y comprimir.
 * La segunda es que así también se ahorra la subida — el joyero manda 200 KB
 * en vez de 3 MB, que desde un celular con datos no es un detalle.
 */

/* El lado más largo. Las fichas muestran la pieza grande y con zoom, así que
   conviene no quedarse corto; de 1600 para arriba ya no se distingue en
   pantalla y sólo pesa. */
const LADO_MAX = 1600
const CALIDAD = 0.82

/** ¿Este navegador sabe escribir WebP? Todos desde 2020, pero se comprueba. */
async function sabeWebp() {
  try {
    const lienzo = document.createElement('canvas')
    lienzo.width = lienzo.height = 1
    const blob = await new Promise((r) => lienzo.toBlob(r, 'image/webp'))
    return !!blob && blob.type === 'image/webp'
  } catch {
    return false
  }
}

/**
 * Devuelve el archivo listo para subir: en WebP y del tamaño justo.
 *
 * Si algo sale mal —un formato raro, un navegador viejo, una foto que ya
 * estaba optimizada— devuelve el original. Nunca impide subir: es mejor una
 * foto pesada publicada que una foto que no se pudo publicar.
 */
export async function optimizarFoto(archivo) {
  if (!archivo?.type?.startsWith('image/')) return archivo
  // Los GIF pueden ser animados y el lienzo se quedaría con el primer cuadro.
  if (archivo.type === 'image/gif') return archivo
  if (typeof createImageBitmap !== 'function') return archivo
  if (!(await sabeWebp())) return archivo

  let mapa
  try {
    /* `from-image` es obligatorio: las fotos de celular traen la orientación
       en los metadatos, y sin esto salen giradas 90 grados. Es el error
       clásico de este trabajo. */
    mapa = await createImageBitmap(archivo, { imageOrientation: 'from-image' })
  } catch {
    return archivo
  }

  const escala = Math.min(1, LADO_MAX / Math.max(mapa.width, mapa.height))
  const ancho = Math.round(mapa.width * escala)
  const alto = Math.round(mapa.height * escala)

  const lienzo = document.createElement('canvas')
  lienzo.width = ancho
  lienzo.height = alto
  const ctx = lienzo.getContext('2d')
  if (!ctx) { mapa.close?.(); return archivo }

  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(mapa, 0, 0, ancho, alto)
  mapa.close?.()

  const blob = await new Promise((r) => lienzo.toBlob(r, 'image/webp', CALIDAD))
  if (!blob) return archivo

  /* Si no quedó más liviana, se sube la original. Pasa con fotos que ya
     venían optimizadas, y reemplazarlas por una peor no tendría sentido. */
  if (blob.size >= archivo.size) return archivo

  const nombre = archivo.name.replace(/\.[^.]+$/, '') + '.webp'
  return new File([blob], nombre, { type: 'image/webp', lastModified: Date.now() })
}
