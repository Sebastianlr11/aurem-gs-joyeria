/**
 * Que el nombre de una pieza no se confunda con el de otra.
 *
 * No es una manía de orden: **Valentina busca las piezas por nombre**. Cuando
 * el modelo dice «mándale el solitario», `buscarPieza()` en `bot.ts` intenta
 * primero el nombre exacto y después uno que lo contenga, y **si le coinciden
 * dos devuelve `null` a propósito** — mandar la pieza equivocada es peor que
 * decir que no se encontró.
 *
 * Así que dos nombres donde uno cabe dentro del otro —«Anillo solitario» y
 * «Anillo solitario clásico»— no le quitan una foto: le quitan las dos. Y el
 * fallo es mudo: la clienta pide una foto y Valentina contesta que no la
 * encuentra, sin que nadie sepa por qué.
 *
 * Por eso se comprueba al guardar, en el panel, que es donde se puede arreglar.
 */

const normal = (t) => String(t || '').trim().toLowerCase()

/**
 * @param {string} nombre  el que se está por guardar
 * @param {Array} piezas   las demás, con `id` y `name`
 * @param {string} [idPropio]  para no chocar consigo misma al editar
 * @returns la pieza con la que se confunde, o `null` si no hay ninguna
 */
export function choqueDeNombre(nombre, piezas, idPropio) {
  const mio = normal(nombre)
  if (!mio) return null

  return (piezas || []).find((p) => {
    if (!p || !p.name) return false
    if (idPropio && p.id === idPropio) return false
    const suyo = normal(p.name)
    if (!suyo) return false
    return mio.includes(suyo) || suyo.includes(mio)
  }) || null
}
