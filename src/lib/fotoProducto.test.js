import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fotoProducto, ANCHOS, TAMANOS_FICHA } from './fotoProducto'

/**
 * Que la foto que se precarga sea EXACTAMENTE la que se pinta.
 *
 * La foto grande de la ficha es su elemento LCP, y desde el 30 de agosto de
 * 2026 el `<script>` de `index.html` la precarga antes de que exista el
 * `<img>` — porque el navegador no se enteraba de que existía hasta bajar el
 * bundle, bajar el trozo de la ficha y renderizar React, sobre el segundo 1,5.
 *
 * Para eso el HTML tiene que armar el mismo `srcset` y el mismo `sizes` que
 * `fotoProducto()`, y no hay forma de compartir una función entre el HTML y el
 * bundle. **Si dejan de coincidir, el navegador precarga un archivo y pinta
 * otro: la foto se baja dos veces.** No hay error, no hay nada raro en
 * pantalla; sólo el doble de datos en el celular de la clienta.
 *
 * Así que esta prueba no compara textos: **saca la función del HTML y la
 * corre** contra la de verdad. Es el mismo trato que tienen la talla del sitio
 * y la de Valentina.
 */
const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')

/* Entre `@copia:fotoProducto` y `@fin`. Si alguien mueve las marcas, esto
   falla en vez de dejar de comparar en silencio. */
const copiaDelHtml = () => {
  const trozo = html.match(/@copia:fotoProducto \*\/\s*([\s\S]*?)\s*\/\* @fin \*\//)
  if (!trozo) throw new Error('No encontré fotoDeLaPieza() entre sus marcas en index.html')
  return new Function(`return ${trozo[1]}`)()
}

/* Una foto subida con el tratamiento completo, y una vieja sin la marca. */
const CON_MARCA = 'https://x.supabase.co/storage/v1/object/public/product-images/1787714368381-abc-1254x1254.webp'
const CHICA = 'https://x.supabase.co/storage/v1/object/public/product-images/1787714368381-abc-600x600.webp'
const SIN_MARCA = 'https://x.supabase.co/storage/v1/object/public/product-images/vieja.jpg'

describe('la precarga de la ficha dice lo mismo que el <img>', () => {
  const fotoDeLaPieza = copiaDelHtml()

  it('arma el mismo srcset para una foto con sus copias', () => {
    const delHtml = fotoDeLaPieza({ images: [CON_MARCA] })
    expect(delHtml.srcset).toBe(fotoProducto(CON_MARCA).srcSet)
  })

  it('y también cuando la foto es más chica que un peldaño de la escalera', () => {
    /* 600 px: la copia de 800 no existe y no puede ofrecerse. Es el caso que
       rompería el srcset apuntando a un archivo que no está. */
    const delHtml = fotoDeLaPieza({ images: [CHICA] })
    expect(delHtml.srcset).toBe(fotoProducto(CHICA).srcSet)
    expect(delHtml.srcset).not.toContain('-w800')
  })

  it('usa el mismo sizes que el <img> de la ficha', () => {
    expect(fotoDeLaPieza({ images: [CON_MARCA] }).sizes).toBe(TAMANOS_FICHA)
  })

  it('mira la misma foto que va a pintar la galería: images[0], o image_url', () => {
    /* `allImages` en ProductPage.jsx: la galería usa `images` si trae algo y
       cae a `image_url` si no. Precargar la otra sería bajar dos fotos. */
    expect(fotoDeLaPieza({ images: [CON_MARCA], image_url: SIN_MARCA }).srcset)
      .toBe(fotoProducto(CON_MARCA).srcSet)
    expect(fotoDeLaPieza({ images: [], image_url: CON_MARCA }).srcset)
      .toBe(fotoProducto(CON_MARCA).srcSet)
  })

  it('una foto sin la marca se precarga sola, sin srcset inventado', () => {
    const delHtml = fotoDeLaPieza({ images: [SIN_MARCA] })
    expect(delHtml.srcset).toBe('')
    expect(delHtml.href).toBe(SIN_MARCA)
    /* Y `fotoProducto` tampoco se inventa uno: un srcset con archivos que no
       existen enseña una foto rota, que es peor que una pesada. */
    expect(fotoProducto(SIN_MARCA).srcSet).toBeUndefined()
  })

  it('una pieza sin ninguna foto no precarga nada', () => {
    expect(fotoDeLaPieza({ images: [], image_url: null })).toBe(null)
  })

  it('nunca pone href junto a imagesrcset', () => {
    /* Con los dos, un navegador que no entiende `imagesrcset` —Safari viejo—
       se bajaría el href y el <img> pintaría otro archivo: la foto, dos
       veces. Sin href, ése simplemente ignora la precarga. */
    expect(fotoDeLaPieza({ images: [CON_MARCA] }).href).toBe('')
  })
})

describe('fotoProducto', () => {
  it('ofrece sólo las copias que existen, más el original', () => {
    expect(fotoProducto(CON_MARCA).srcSet).toBe(
      `${CON_MARCA.replace('-1254x1254.webp', '')}-w400.webp 400w, ` +
      `${CON_MARCA.replace('-1254x1254.webp', '')}-w800.webp 800w, ` +
      `${CON_MARCA} 1254w`,
    )
  })

  it('reserva el sitio con las medidas del nombre', () => {
    expect(fotoProducto(CON_MARCA)).toMatchObject({ width: 1254, height: 1254 })
  })

  it('sin medidas para el visor, donde el CSS manda', () => {
    expect(fotoProducto(CON_MARCA, { conMedidas: false }).width).toBeUndefined()
  })

  it('la escalera es la que se generó al subir las fotos', () => {
    /* Cambiar esta lista sin resubir deja el srcset apuntando a archivos que
       no existen. */
    expect(ANCHOS).toEqual([400, 800])
  })
})
