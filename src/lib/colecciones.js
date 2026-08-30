import { CATEGORIAS } from './categorias'

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
 * 3. **La foto es la de la pieza más reciente**, y las agotadas van al final:
 *    la portada no invita a una vitrina cuya cara está vendida.
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
      .sort((a, b) => agotada(a) - agotada(b) || cuando(b) - cuando(a))

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

const orden = (categoria) => CATEGORIAS.indexOf(categoria)
const agotada = (p) => (p.stock === 0 ? 1 : 0)
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
