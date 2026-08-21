/**
 * Empaqueta las plantillas de correo en un módulo que la función de Vercel
 * pueda importar sin saber nada de JSX.
 *
 * Por qué no importar los .tsx directamente desde api/correo.js: esos
 * archivos no están en ningún tsconfig del proyecto —los de aquí cubren src/
 * y vite— así que quien tenga que compilarlos en el despliegue lo haría
 * adivinando la configuración de JSX. Cuando eso falla, falla al desplegar y
 * con un error que no señala la causa.
 *
 * Con esbuild queda decidido acá, donde se puede comprobar: entra
 * emails/_render.ts y sale api/_plantillas.mjs, JavaScript plano.
 *
 * Sólo se empaqueta lo nuestro: React y react-email se quedan fuera y se
 * resuelven desde node_modules al ejecutar. Meterlos dentro rompía —
 * react-dom/server usa require() de módulos de Node y en formato ESM eso
 * revienta con "Dynamic require of util is not supported"— y además no hacía
 * falta: Vercel instala las dependencias del proyecto para las funciones.
 */
import { build } from 'esbuild'
import { mkdirSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const salida = resolve(raiz, 'api/_plantillas.mjs')

mkdirSync(dirname(salida), { recursive: true })

await build({
  entryPoints: [resolve(raiz, 'emails/_render.ts')],
  outfile: salida,
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  jsx: 'automatic',
  /* Todo lo de node_modules, fuera. Lo único que hay que traducir es el JSX
     de las plantillas. */
  packages: 'external',
  /* Sin minificar: si algún día hay que leer el HTML que sale, se agradece.
     Y el peso da igual — no lo descarga ningún navegador. */
  minify: false,
  logLevel: 'warning',
})

console.log(`correos: api/_plantillas.mjs · ${(statSync(salida).size / 1024).toFixed(0)} KB`)
