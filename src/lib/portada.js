import { CATEGORIAS } from './categorias'

/**
 * Qué saca la portada del catálogo: las tres colecciones y el carrusel.
 *
 * Las dos secciones enseñaban fotos de banco escritas a mano, y las dos se
 * quedaban quietas mientras el taller subía piezas de verdad. Están juntas
 * aquí porque comparten el criterio —**manda `is_featured`**— y porque así se
 * prueban sin montar la portada entera.
 */

/**
 * Qué colecciones enseña la portada.
 *
 * Hasta el 30 de agosto de 2026 eran tres escritas a mano —Anillos, Collares
 * y Pulseras— con foto de banco y una frase que hablaba de platino y de
 * diamantes. Dos problemas: **«Collares» llevaba a una vitrina vacía** (no hay
 * ni una en el catálogo) y las tres se quedaban quietas mientras el taller
 * subía topos, dijes y juegos que no aparecían por ninguna parte.
 *
 * Ahora salen del catálogo. Las reglas, en orden:
 *
 * 1. **Sólo categorías con una foto que enseñar.** Una tarjeta sin foto es un
 *    rectángulo gris del alto de una tarjeta, y un hueco se ve peor que una
 *    colección de menos.
 * 2. **Manda cuántas piezas hay**, y los empates los rompe el orden del riel
 *    del catálogo, para que la portada y el catálogo no se contradigan.
 * 3. **La cara la escoge el joyero** con el interruptor «Destacado» del panel,
 *    que hasta hoy prometía «aparece en la portada» sin que la portada leyera
 *    nada. Si no hay ninguna destacada manda la más reciente, y las agotadas
 *    van al final en los dos casos: la portada no invita a una vitrina cuya
 *    cara está vendida.
 *
 * Es una función aparte y no un `useMemo` dentro del componente porque así se
 * puede probar: son tres reglas y cada una tiene una forma de salir mal.
 *
 * @param {Array} piezas  filas de `products` — `category`, `image_url`, `metal`, `stock`, `created_at`, `name`
 * @param {number} cuantas  cuántas tarjetas caben en la rejilla
 */
export function coleccionesDe(piezas, cuantas = 3) {
  const porCategoria = new Map()

  for (const p of piezas || []) {
    /* Una categoría que no está en la lista —un dato viejo, un typo escrito
       directo en la base— no pinta una tarjeta que nadie sabe describir. */
    if (!p || !CATEGORIAS.includes(p.category)) continue
    if (!porCategoria.has(p.category)) porCategoria.set(p.category, [])
    porCategoria.get(p.category).push(p)
  }

  const colecciones = []

  for (const [categoria, suyas] of porCategoria) {
    const conFoto = suyas
      .filter((p) => p.image_url)
      .sort(deCara)

    if (!conFoto.length) continue

    const cara = conFoto[0]

    colecciones.push({
      categoria,
      piezas: suyas.length,
      foto: cara.image_url,
      /* El `alt` describe la foto, que es una pieza concreta, no la
         categoría entera: quien la escucha con un lector de pantalla oye lo
         que hay en la imagen. */
      alt: cara.name || `Pieza de ${categoria.toLowerCase()} de Aurem Gs Joyería`,
      metal: punzonDe(suyas),
    })
  }

  return colecciones
    .sort((a, b) => b.piezas - a.piezas || orden(a.categoria) - orden(b.categoria))
    .slice(0, cuantas)
}

/**
 * Las piezas del carrusel de «Piezas seleccionadas».
 *
 * Seleccionadas de verdad: las que el joyero marcó «Destacado» en el panel, y
 * detrás las más recientes hasta llenar la cinta. Antes eran cinco fotos de
 * banco en `public/assets`, las mismas desde el primer día.
 *
 * Devuelve la lista **sin duplicar**: el bucle continuo lo arma el componente
 * repitiéndola, porque la animación del CSS va a `-50%` y necesita las dos
 * mitades iguales.
 */
export function piezasDelCarrusel(piezas, cuantas = 5) {
  return (piezas || [])
    .filter((p) => p && p.image_url)
    .sort(deCara)
    .slice(0, cuantas)
}

/* El mismo criterio para la cara de una colección y para la cinta: primero lo
   que se puede vender, dentro de eso lo que el joyero destacó, y al final lo
   más reciente. */
const deCara = (a, b) => agotada(a) - agotada(b) || destacada(b) - destacada(a) || cuando(b) - cuando(a)

const orden = (categoria) => CATEGORIAS.indexOf(categoria)
const agotada = (p) => (p.stock === 0 ? 1 : 0)
const destacada = (p) => (p.is_featured ? 1 : 0)
const cuando = (p) => new Date(p.created_at || 0).getTime() || 0

/**
 * El sello de metal de una colección.
 *
 * Con un solo metal se dice entero —«Plata 925»—; con varios de la misma
 * familia se sube a la familia, porque «Oro 18k» al lado de «Oro blanco 18k»
 * no cabe en un sello de 24 píxeles. Y si ninguna pieza tiene metal anotado
 * **no se inventa ninguno**: en el catálogo de hoy nueve de veinte anillos lo
 * tienen vacío, y un sello que dice «Oro 18k» sobre una vitrina de plata es
 * exactamente la clase de promesa que ya hubo que quitar del JSON-LD.
 */
export function punzonDe(piezas) {
  const metales = [...new Set((piezas || []).map((p) => (p.metal || '').trim()).filter(Boolean))]
  if (!metales.length) return null
  if (metales.length === 1) return metales[0]

  const familias = [...new Set(metales.map(familia).filter(Boolean))]
  if (familias.length === 1) return familias[0]
  if (familias.length === 2 && familias.includes('Oro') && familias.includes('Plata')) {
    return 'Oro y plata'
  }
  return null
}

const familia = (metal) => {
  const m = metal.toLowerCase()
  if (m.startsWith('oro')) return 'Oro'
  if (m.startsWith('plata')) return 'Plata'
  return null
}
