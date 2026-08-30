/**
 * Redactar el nombre y la descripción de una pieza, mirándole la foto.
 *
 * Lo escrito a mano funcionó: las 31 piezas se reescribieron el 30 de agosto
 * de 2026 con una fórmula —nombre de 33 caracteres, descripción de dos frases
 * y 180— y el catálogo cambió de cara. Lo que no escala es acordarse de la
 * fórmula a las once de la noche subiendo la pieza número 32.
 *
 * Esto es la parte del trabajo que **no** toca Deno ni la red: armar lo que se
 * le pide al modelo y revisar lo que contesta. Vive aquí por el mismo motivo
 * que `reglas.ts`: para poder probarlo desde Node, sin desplegar y sin gastar
 * un céntimo de modelo.
 *
 * ── La regla que hace que esto no sea peligroso ─────────────────────────────
 *
 * **El modelo describe la forma. Los hechos los pone el joyero.**
 *
 * Un modelo de visión dice «esmeralda natural colombiana» de un circón verde
 * sin pestañear, y eso no es un texto feo: es una promesa falsa en la ficha,
 * en el dato estructurado que lee Google y en lo que Valentina le repite a la
 * clienta. Es el mismo error que este proyecto lleva corrigiendo desde agosto
 * —el platino que no existe, el certificado que se cobra, los plazos—.
 *
 * Así que el metal y la piedra **se le entregan ya escritos** y se le prohíbe
 * inventar cualquier otro. Si el metal está vacío, no se le pregunta: se
 * devuelve que falta. Sin ese dato el texto se lo tendría que imaginar.
 */

export type DatosDePieza = {
  categoria?: string | null
  metal?: string | null
  piedra?: string | null
  precio?: number | null
  talla_rango?: string | null
  /* Lo que el joyero quiera añadir de su puño: «es por encargo», «la piedra
     es de Muzo». Va tal cual al modelo, y manda sobre lo que él vea. */
  notas?: string | null
}

export type Borrador = { nombre: string; descripcion: string }

export const NOMBRE_MAX = 33
export const DESC_MAX = 180

/**
 * Lo que hay que tener antes de preguntarle nada al modelo.
 * @returns qué falta, o `null` si no falta nada.
 */
export function queFaltaParaRedactar(datos: DatosDePieza, fotos: string[]): string | null {
  if (!fotos?.length) return 'Sube al menos una foto: el texto sale de mirarla.'
  if (!String(datos?.metal || '').trim()) {
    return 'Escribe primero el metal. Es un dato del taller, no algo que se vea en una foto.'
  }
  return null
}

/** Lo que se le dice al modelo. Sin fotos: ésas las adjunta quien llama. */
export function instrucciones(datos: DatosDePieza, nombresExistentes: string[] = []): string {
  const ficha = [
    datos.categoria && `Categoría: ${datos.categoria}`,
    datos.metal && `Metal: ${datos.metal}`,
    datos.piedra ? `Piedra: ${datos.piedra}` : 'Piedra: ninguna',
    datos.talla_rango && `Tallas: ${datos.talla_rango}`,
    datos.precio ? `Precio: $${Math.round(datos.precio).toLocaleString('es-CO')} COP` : null,
    datos.notas && `El joyero añade: ${datos.notas}`,
  ].filter(Boolean).join('\n')

  /* Los nombres que ya están, para que no proponga uno que se confunda.
     Valentina busca las piezas por nombre y con dos parecidas no manda
     ninguna de las dos fotos. */
  const ocupados = nombresExistentes.filter(Boolean).map((n) => `- ${n}`).join('\n')

  return `Escribes el catálogo de Aurem Gs, una joyería de Bogotá que trabaja oro y plata
con esmeralda colombiana natural. Español de Colombia, sin adjetivos de folleto.

Mirando la foto, devuelve el NOMBRE y la DESCRIPCIÓN de esta pieza.

LO QUE SABES DE LA PIEZA (es la verdad; no la contradigas ni la amplíes):
${ficha}

REGLA QUE NO SE ROMPE: describe la FORMA y el ACABADO que ves —la talla de la
piedra, cómo va montada, si la banda es lisa, tallada o partida, si es un par—.
NO afirmes de qué metal ni de qué piedra es más allá de lo que está escrito
arriba, ni quilates, ni peso, ni calidad, ni origen de la piedra. Eso lo sabe el
taller con la pieza en la mano, no se ve en una foto, y decirlo mal es prometerle
a una clienta algo que no va a recibir. Si no distingues algo, no lo menciones.

NOMBRE — máximo ${NOMBRE_MAX} caracteres:
· Tipo de pieza y su rasgo distintivo. «Anillo solitario clásico», «Juego de
  barra torsionada», «Argollas eslabón cubano».
· NO metas el metal ni la palabra «natural»: ya se pintan debajo, en su casilla.
· NO uses «—», ni «par», ni comas.
· No puede parecerse a ninguno de estos, ni contenerlos ni estar contenido:
${ocupados || '(el catálogo está vacío)'}

DESCRIPCIÓN — máximo ${DESC_MAX} caracteres, dos frases:
· La primera dice qué es, de qué metal y con qué piedra, con las palabras de la
  ficha de arriba. Es lo que le preguntan a la asesora por WhatsApp.
· La segunda, el rasgo que la distingue o para quién es. Concreta, no publicitaria.
· Nada de emojis, ni de «¡», ni de promesas de envío, garantía o certificado.

Responde SÓLO este JSON, sin texto alrededor ni bloques de código:
{"nombre": "...", "descripcion": "..."}`
}

/**
 * Saca el borrador de lo que contestó el modelo.
 *
 * Aunque se le pida JSON pelado, a veces llega envuelto en ```json — no es un
 * fallo del modelo, es cómo lo entrenaron. Se le quita la envoltura antes de
 * darlo por ilegible.
 */
export function leerRespuesta(texto: string | null | undefined): Borrador | null {
  const crudo = String(texto || '').trim()
  if (!crudo) return null

  const sinCerca = crudo.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  const desde = sinCerca.indexOf('{')
  const hasta = sinCerca.lastIndexOf('}')
  if (desde === -1 || hasta === -1 || hasta < desde) return null

  let datos: unknown
  try { datos = JSON.parse(sinCerca.slice(desde, hasta + 1)) } catch { return null }

  const obj = datos as Record<string, unknown>
  const nombre = limpiar(obj?.nombre)
  const descripcion = limpiar(obj?.descripcion)
  if (!nombre || !descripcion) return null

  return { nombre, descripcion }
}

/**
 * Revisa el borrador contra la fórmula, sin corregirlo.
 *
 * Los avisos viajan al panel y se enseñan al lado de los campos: quien sube la
 * pieza decide si el nombre largo se queda —una pieza rara puede necesitarlo—
 * o lo recorta. Lo único que sí se arregla solo son las comillas y los espacios
 * de más, que no son una decisión de nadie.
 */
export function revisarBorrador(
  borrador: Borrador,
  nombresExistentes: string[] = [],
): { borrador: Borrador; avisos: string[] } {
  const nombre = borrador.nombre.replace(/^[«"']|[»"']$/g, '').trim()
  const descripcion = borrador.descripcion.trim()
  const avisos: string[] = []

  if (nombre.length > NOMBRE_MAX) {
    avisos.push(`El nombre va largo (${nombre.length} de ${NOMBRE_MAX}): en la rejilla ocupará dos renglones.`)
  }
  if (descripcion.length > DESC_MAX) {
    avisos.push(`La descripción pasa de ${DESC_MAX}: a Valentina le llegará cortada.`)
  }

  const enMinusculas = nombre.toLowerCase()
  const choque = nombresExistentes.find((otro) => {
    const suyo = String(otro || '').trim().toLowerCase()
    return suyo && (enMinusculas.includes(suyo) || suyo.includes(enMinusculas))
  })
  if (choque) {
    avisos.push(`«${nombre}» se confunde con «${choque}»: Valentina no podría mandar ninguna de las dos.`)
  }

  return { borrador: { nombre, descripcion }, avisos }
}

const limpiar = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim()
