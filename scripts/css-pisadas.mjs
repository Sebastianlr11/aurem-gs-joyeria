/**
 * Qué reglas de CSS no hacen nada.
 *
 * `src/index.css` arrastra dos diseños. El panel de administración y el de
 * chat se rehicieron —del azul oscuro con oro brillante al cacao con oro
 * viejo— y las reglas viejas nunca se borraron: se pegaron las nuevas
 * después. El navegador aplica la última, así que lo que está escrito arriba
 * es letra muerta.
 *
 * El costo no son los bytes. Es que alguien —incluido quien escribe esto—
 * edita una regla, recarga, y no pasa nada. Se pierde media hora buscando el
 * error en el sitio equivocado.
 *
 * Esto no arregla nada: dice dónde mirar. Antes de tocar una regla que no
 * responde, correr esto y ver si está pisada.
 *
 *   node scripts/css-pisadas.mjs
 *   node scripts/css-pisadas.mjs .chat-send-btn
 */
import fs from 'node:fs'

/* Sin argumento mira todas las hojas del proyecto. Eran dos —la tienda y el
   panel— hasta el 30 de agosto de 2026, cuando la de la tienda se partió y
   cada ruta perezosa se llevó la suya. Se buscan en disco y no a mano: una
   lista escrita queda desactualizada el día que alguien añade una hoja, y un
   diagnóstico que no mira un archivo dice «ninguna regla pisada» con la misma
   confianza que si lo hubiera mirado.

   **Ojo con lo que este informe NO puede ver desde que hay varias hojas**: sólo
   compara dentro de un archivo. Un par en el que el perdedor está en
   `index.css` y el ganador en una hoja de ruta —que se carga después— es
   invisible aquí. Para eso está `scripts/huella-estilos.mjs`, que mide lo que
   se ve en vez de leer lo que está escrito. */
const RUTAS = process.argv.filter((a) => a.endsWith('.css'))
const ARCHIVOS = RUTAS.length ? RUTAS : [
  'src/index.css',
  'src/panel.css',
  ...fs.globSync('src/{pages,components}/**/*.css').sort(),
]

/* Los comentarios se reemplazan por sus mismos saltos de línea. Quitarlos
   correría la numeración, y un informe que apunta a la línea equivocada es
   peor que no tener informe. */
const sinComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => '\n'.repeat((m.match(/\n/g) || []).length))

function bloques(texto) {
  /* Se recorre carácter a carácter y no línea a línea. La versión anterior
     apilaba el contexto cuando una línea EMPEZABA por @media y lo desapilaba
     cuando una línea era exactamente "}", así que una regla de una sola línea
     —`@media (min-width: 769px) { .admin-layout { ... } }`, que las hay a
     docenas— se apilaba y no se desapilaba nunca. El contexto quedaba
     contaminado para todo lo que viniera después, y dos reglas que en realidad
     viven en medias distintas parecían estar en el mismo sitio.

     Eso no era un detalle: este informe se usa para decidir qué declaraciones
     sobran, y con el contexto mal, borrar lo que dice sí cambia la página. */
  const out = []
  const pila = []          // contextos @media/@supports abiertos, por profundidad
  let i = 0
  let linea = 1
  let inicioPrelude = 0
  let preludeLinea = 1
  const n = texto.length

  const salta = (desde, hasta) => {
    for (let k = desde; k < hasta; k++) if (texto[k] === '\n') linea++
  }

  while (i < n) {
    const c = texto[i]

    if (c === '{') {
      const prelude = texto.slice(inicioPrelude, i).trim()
      const esAt = prelude.startsWith('@')

      if (esAt) {
        pila.push({ texto: prelude, prof: pila.length })
        salta(inicioPrelude, i + 1)
        i++; inicioPrelude = i; preludeLinea = linea
        continue
      }

      /* Regla normal: se busca su cierre contando llaves. */
      let prof = 1, j = i + 1
      while (j < n && prof > 0) {
        if (texto[j] === '{') prof++
        else if (texto[j] === '}') prof--
        j++
      }
      const cuerpo = texto.slice(i + 1, j - 1)
      const lineaIni = preludeLinea

      const props = new Map()
      let limpio = !cuerpo.includes('{')
      if (limpio) {
        for (const trozo of cuerpo.split(';')) {
          const t = trozo.trim()
          if (!t) continue
          const m = /^([a-zA-Z-]+)\s*:\s*([\s\S]+)$/.exec(t)
          if (m) props.set(m[1], m[2].trim())
          else limpio = false
        }
      }

      salta(inicioPrelude, j)
      const lineaFin = linea
      if (limpio && prelude && !/^\d|^from\b|^to\b/.test(prelude)) {
        out.push({ ini: lineaIni, fin: lineaFin, ctx: pila.map((p) => p.texto).join(' | '), selector: prelude, props })
      }
      i = j; inicioPrelude = i; preludeLinea = linea
      continue
    }

    if (c === '}') {
      if (pila.length) pila.pop()
      salta(inicioPrelude, i + 1)
      i++; inicioPrelude = i; preludeLinea = linea
      continue
    }

    i++
  }
  return out
}

const filtro = process.argv.slice(2).find((a) => !a.endsWith('.css'))

/* Para cada selector, en cada contexto, se recorren sus apariciones en orden
   y se anota qué propiedad pisa a cuál. */
function analizar(ruta) {
  const css = sinComentarios(fs.readFileSync(ruta, 'utf8'))
  const bs = bloques(css)

  const porSelector = new Map()
  for (const b of bs) {
    if (b.selector.includes(',')) continue
    const clave = `${b.ctx}||${b.selector}`
    if (!porSelector.has(clave)) porSelector.set(clave, [])
    porSelector.get(clave).push(b)
  }

  const hallazgos = []
  for (const [clave, apariciones] of porSelector) {
    if (apariciones.length < 2) continue
    const [, selector] = clave.split('||')
    if (filtro && !selector.includes(filtro)) continue

    for (let a = 0; a < apariciones.length - 1; a++) {
      const pisadas = []
      for (const [prop, valor] of apariciones[a].props) {
        for (let b = a + 1; b < apariciones.length; b++) {
          const despues = apariciones[b].props.get(prop)
          if (despues !== undefined && despues !== valor) {
            pisadas.push({ prop, valor, gana: despues, linea: apariciones[b].ini })
            break
          }
        }
      }
      if (pisadas.length) {
        hallazgos.push({
          archivo: ruta,
          selector,
          ctx: apariciones[a].ctx,
          linea: apariciones[a].ini,
          total: apariciones[a].props.size,
          pisadas,
        })
      }
    }
  }
  return hallazgos
}

const hallazgos = ARCHIVOS.flatMap(analizar)

if (!hallazgos.length) {
  console.log(filtro ? `Nada pisado en "${filtro}".` : 'Ninguna regla pisada. Raro, pero bueno.')
  process.exit(0)
}

const inertes = hallazgos.filter((h) => h.pisadas.length === h.total)

console.log(`${hallazgos.length} bloques con declaraciones que no hacen nada`)
console.log(`${inertes.length} de ellos completamente inertes: se pueden borrar enteros`)
for (const r of ARCHIVOS) {
  const n = hallazgos.filter((h) => h.archivo === r).length
  console.log(`   ${r}: ${n}`)
}
console.log()

for (const h of hallazgos.sort((a, b) => b.pisadas.length - a.pisadas.length).slice(0, filtro ? 99 : 25)) {
  const marca = h.pisadas.length === h.total ? ' \u2190 INERTE ENTERO' : ''
  console.log(`${h.archivo}:${h.linea}  ${h.selector}${h.ctx ? `  [${h.ctx}]` : ''}${marca}`)
  for (const p of h.pisadas) {
    console.log(`      ${p.prop}: ${p.valor}   \u2192   L${p.linea} gana con ${p.gana}`)
  }
  console.log()
}
