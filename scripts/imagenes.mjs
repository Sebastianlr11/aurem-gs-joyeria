/**
 * Convierte las fotos del sitio a WebP, en dos anchos.
 *
 * Estaban en JPEG y muy por encima de su tamaño real: las del carrusel
 * pesaban 147 KB para mostrarse a 290 píxeles de ancho, casi cinco veces más
 * de lo necesario. Con 4G lento eso es medio megabyte que el cliente paga
 * para ver lo mismo.
 *
 * Dos anchos porque la misma foto se ve muy distinta según la pantalla, y
 * srcset deja que el navegador elija. Los números salen de medir cuánto
 * ocupan de verdad, no de redondear: el carrusel se ve a 290 px y las
 * tarjetas a 370, así que el doble de eso cubre las pantallas de densidad 2.
 *
 * Se corre a mano cuando se agrega una foto:  npm run imagenes
 */
import sharp from 'sharp'
import fs from 'node:fs/promises'
import path from 'node:path'

const CARPETA = 'public/assets'

/* Qué ancho necesita cada una, según dónde se usa. El original se conserva:
   es la fuente de la que salen estas, y el respaldo si un navegador viejo no
   entiende WebP. */
const ANCHOS = {
  'pen-hero': [768, 928],
  'pen-anillos': [768, 928],
  'pen-collares': [768, 928],
  'pen-pulseras': [768, 928],
  'pen-pieza-1': [640, 1280],
  'pen-pieza-2': [640, 1280],
  'pen-pieza-3': [640, 1280],
  'pen-pieza-4': [640, 1280],
  'pen-pieza-5': [640, 1280],
}

const kb = (n) => Math.round(n / 1024)

const archivos = (await fs.readdir(CARPETA)).filter((f) => f.endsWith('.jpg'))
let antes = 0
let despues = 0

for (const archivo of archivos) {
  const base = path.basename(archivo, '.jpg')
  const anchos = ANCHOS[base]
  if (!anchos) {
    console.log(`  (se salta ${archivo}: no está en la lista)`)
    continue
  }

  const origen = path.join(CARPETA, archivo)
  const peso = (await fs.stat(origen)).size
  antes += peso

  const salidas = []
  for (const ancho of anchos) {
    const destino = path.join(CARPETA, `${base}-${ancho}.webp`)
    /* calidad 78: por debajo se nota el ruido en los degradados del metal,
       que es justo donde se mira una foto de joyería. */
    await sharp(origen).resize({ width: ancho, withoutEnlargement: true })
      .webp({ quality: 78, effort: 6 }).toFile(destino)
    const p = (await fs.stat(destino)).size
    despues += p
    salidas.push(`${ancho}w ${kb(p)}KB`)
  }

  console.log(`  ${archivo.padEnd(20)} ${kb(peso)}KB  →  ${salidas.join(' · ')}`)
}

console.log(`\n  originales: ${kb(antes)}KB · webp generados: ${kb(despues)}KB`)
