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

const RUTA = 'src/index.css'

/* Los comentarios se reemplazan por sus mismos saltos de línea. Quitarlos
   correría la numeración, y un informe que apunta a la línea equivocada es
   peor que no tener informe. */
const sinComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => '\n'.repeat((m.match(/\n/g) || []).length))

function bloques(texto) {
  const lineas = texto.split('\n')
  const pila = []
  const out = []
  let i = 0

  while (i < lineas.length) {
    const s = lineas[i].trim()

    if (s.startsWith('@media') || s.startsWith('@supports')) { pila.push(s); i++; continue }
    if (s.startsWith('@')) { i++; continue }

    if (s.includes('{') && !s.startsWith('}')) {
      const selector = s.split('{')[0].trim()
      let prof = (s.match(/{/g) || []).length - (s.match(/}/g) || []).length
      const cuerpo = []
      let j = i + 1
      while (j < lineas.length && prof > 0) {
        prof += (lineas[j].match(/{/g) || []).length - (lineas[j].match(/}/g) || []).length
        if (prof > 0) cuerpo.push(lineas[j])
        j++
      }

      const props = new Map()
      let limpio = true
      for (const l of cuerpo) {
        const m = /^\s*([a-zA-Z-]+)\s*:\s*([^;]+);\s*$/.exec(l)
        if (m) props.set(m[1], m[2].trim())
        else if (l.trim()) limpio = false
      }

      // Se ignoran los fotogramas de las animaciones y los selectores en lista.
      if (limpio && selector && !/^\d|^from\b|^to\b/.test(selector)) {
        out.push({ ini: i + 1, fin: j, ctx: pila.join(' | '), selector, props })
      }
      i = j
      continue
    }

    if (s === '}' && pila.length) pila.pop()
    i++
  }
  return out
}

const css = sinComentarios(fs.readFileSync(RUTA, 'utf8'))
const bs = bloques(css)
const filtro = process.argv[2]

/* Para cada selector, en cada contexto, se recorren sus apariciones en orden
   y se anota qué propiedad pisa a cuál. */
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
        selector,
        ctx: apariciones[a].ctx,
        linea: apariciones[a].ini,
        total: apariciones[a].props.size,
        pisadas,
      })
    }
  }
}

if (!hallazgos.length) {
  console.log(filtro ? `Nada pisado en "${filtro}".` : 'Ninguna regla pisada. Raro, pero bueno.')
  process.exit(0)
}

const inertes = hallazgos.filter((h) => h.pisadas.length === h.total)

console.log(`${hallazgos.length} bloques con declaraciones que no hacen nada`)
console.log(`${inertes.length} de ellos completamente inertes: se pueden borrar enteros\n`)

for (const h of hallazgos.sort((a, b) => b.pisadas.length - a.pisadas.length).slice(0, filtro ? 99 : 25)) {
  const marca = h.pisadas.length === h.total ? ' ← INERTE ENTERO' : ''
  console.log(`L${h.linea}  ${h.selector}${h.ctx ? `  [${h.ctx}]` : ''}${marca}`)
  for (const p of h.pisadas) {
    console.log(`      ${p.prop}: ${p.valor}   →   L${p.linea} gana con ${p.gana}`)
  }
  console.log()
}
