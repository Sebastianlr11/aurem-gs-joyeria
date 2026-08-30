/**
 * El `<title>` de una ficha, para Google.
 *
 * Hasta el 30 de agosto de 2026 era `nombre — $precio | Aurem Gs Joyería`, y
 * salía a unos noventa caracteres. **Google corta en unos sesenta**, así que
 * lo que se perdía era el final: a veces la marca entera. Y el precio ocupaba
 * doce caracteres para decir algo que ya va en el JSON-LD, que es de donde
 * sale el precio del resultado enriquecido.
 *
 * Ahora el nombre de la pieza es corto —«Anillo solitario clásico», no «Anillo
 * solitario clásico en plata 925 con esmeralda natural»— y las palabras que se
 * buscan se le añaden aquí, con lo que ya está en sus columnas. Se prueban
 * varias formas y se toma la primera que quepa, de la más completa a la más
 * escueta; el orden no es casual: **la piedra antes que el metal**, porque
 * quien busca esto busca esmeralda.
 *
 * El precio sigue en el título que sirve `api/ficha.js` a WhatsApp y Facebook,
 * y ahí debe seguir: en un chat, el precio es la mitad de por qué se comparte
 * el enlace. Esto es sólo lo que lee un buscador.
 */

const MARCA = 'Aurem Gs'

/* Sesenta es lo que Google enseña en escritorio antes de poner puntos
   suspensivos. No es una regla suya publicada, es el ancho en píxeles de la
   caja; sesenta caracteres es la aproximación que se usa. */
const MAXIMO = 60

/* «Esmeralda natural colombiana y circones» es una ficha técnica, no una
   palabra de búsqueda. Se corta en la primera coma y en el primer «con»,
   igual que en la tarjeta del catálogo. */
const piedraCorta = (piedra) =>
  String(piedra || '').split(/,| con | y /i)[0].trim().toLowerCase()

/* «esmeralda natural» → «esmeralda», el último recurso antes de quedarse sin
   piedra. Vale más una palabra que se busca que el adjetivo. */
const piedraMinima = (piedra) => piedraCorta(piedra).split(/\s+/)[0] || ''

/* La raíz de la palabra, para preguntarle al nombre si ya la dice:
   «esmeraldas» → «esmeralda», «granates» → «granat», «circones» → «circon».
   La de granate no es una palabra: no importa, sólo se usa para buscarla
   dentro del nombre. */
const raiz = (palabra) => palabra.replace(/e?s$/, '')

export function tituloDePieza(pieza) {
  const nombre = String(pieza?.name || '').trim()
  if (!nombre) return `Joyería con esmeralda colombiana | ${MARCA}`

  const metal = String(pieza?.metal || '').trim()
  const enMinusculas = nombre.toLowerCase()

  /* Dos motivos para no añadir la piedra, los dos porque el título quedaba
     mal leído: que el nombre ya la diga —«Dije cruz de esmeraldas con
     esmeraldas naturales»— o que el nombre ya lleve un «con» —«Anillo bicolor
     con pavé con circones»—. Cuando pasa, gana el metal. */
  const semilla = raiz(piedraMinima(pieza?.piedra))
  const repetiria = (semilla && enMinusculas.includes(semilla)) || / con /.test(enMinusculas)

  const piedra = repetiria ? '' : piedraCorta(pieza?.piedra)
  const minima = repetiria ? '' : piedraMinima(pieza?.piedra)

  const formas = [
    [piedra && `con ${piedra}`, metal && `en ${metal}`],
    [piedra && `con ${piedra}`],
    [minima && `con ${minima}`],
    [metal && `en ${metal}`],
    [],
  ]

  for (const partes of formas) {
    const titulo = [nombre, ...partes.filter(Boolean)].join(' ') + ` | ${MARCA}`
    if (titulo.length <= MAXIMO) return titulo
  }

  /* Un nombre largo se sale de los sesenta él solo. Se deja entero: cortarlo
     a mitad de palabra es peor que un título largo, y Google enseña lo que
     quepa. */
  return `${nombre} | ${MARCA}`
}
