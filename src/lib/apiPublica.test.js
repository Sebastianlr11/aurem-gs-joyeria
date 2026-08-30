import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { COLUMNAS_DE_PIEZA } from './apiPublica'

/**
 * Esta prueba no comprueba código: **compara dos copias**.
 *
 * La consulta de la pieza está escrita dos veces —en `apiPublica.js` y en el
 * `<script>` de `index.html` que la adelanta— porque no hay forma de compartir
 * una constante entre el HTML y el bundle. Si dejan de coincidir no se rompe
 * nada a la vista: la ficha sigue cargando, sólo que por el camino lento, y
 * peor todavía si al adelanto le falta una columna —el `<img>` se quedaría sin
 * `images[]` y la galería sin fotos, con la pieza «ya cargada»—.
 *
 * Es el mismo trato que tienen la talla del sitio y la de Valentina.
 */
const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')

describe('el adelanto de la pieza en index.html', () => {
  it('pregunta por las mismas columnas que apiPublica.js', () => {
    expect(html).toContain(`select=${COLUMNAS_DE_PIEZA}&id=eq.`)
  })

  it('sigue ahí y deja la promesa donde traerPieza la busca', () => {
    expect(html).toContain('window.__pieza')
    expect(html).toContain('promesa:')
  })

  it('sólo pregunta en una ficha, no en toda ruta', () => {
    expect(html).toMatch(/location\.pathname\.match\([^)]*catalogo/)
  })
})

describe('las columnas de la pieza', () => {
  /* `costo` y `costo_provisional` están muertas desde el 23 de agosto de 2026
     —el costo vive en el pedido— pero siguen en la tabla, y ésta es una
     lectura con la llave pública: un `select=*` le enseña a cualquiera lo que
     le cuesta cada pieza al taller. Por eso las columnas se nombran. */
  it('no traen el costo', () => {
    expect(COLUMNAS_DE_PIEZA).not.toMatch(/\bcosto/)
  })

  it('traen lo que la ficha necesita para pintarse', () => {
    for (const columna of ['id', 'name', 'price', 'images', 'description', 'category']) {
      expect(COLUMNAS_DE_PIEZA.split(',')).toContain(columna)
    }
  })
})
