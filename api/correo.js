/**
 * El único sitio desde el que sale un correo.
 *
 * Quien dispara los avisos es el webhook de Mercado Pago, que corre en Deno,
 * y las plantillas son componentes React. En vez de forzar React dentro de
 * Deno, el webhook llama aquí: las plantillas viven donde React es nativo y
 * hay un solo lugar que tocar el día que cambie el pie de página.
 *
 * No es público. Lleva un secreto compartido en la cabecera porque, sin él,
 * cualquiera podría mandarle correos con la marca de la joyería a quien
 * quisiera — que es peor que una fuga de datos: es suplantación.
 */
import { Resend } from 'resend'
import { componer, NOMBRES } from './_plantillas.mjs'

const REMITENTE = 'Aurem Gs Joyería <hola@auremgsjoyeria.com>'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Sólo POST' })
  }

  const secreto = process.env.CORREO_SECRETO
  const clave = process.env.RESEND_API_KEY

  if (!secreto || !clave) {
    console.error('correo: faltan CORREO_SECRETO o RESEND_API_KEY')
    return res.status(500).json({ error: 'Sin configurar' })
  }

  /* Comparación de largo constante. Con un === normal, el tiempo que tarda en
     fallar delata cuántos caracteres acertó quien lo intenta, y con
     suficientes intentos se adivina el secreto letra a letra. */
  const enviado = String(req.headers['x-correo-secreto'] ?? '')
  if (!iguales(enviado, secreto)) {
    return res.status(401).json({ error: 'No autorizado' })
  }

  const { plantilla, para, datos, referencia } = req.body ?? {}

  if (!NOMBRES.includes(plantilla)) {
    return res.status(400).json({ error: `Plantilla desconocida: ${plantilla}` })
  }
  /* Uno o varios. Los avisos internos van a todo el equipo, y mandarlos en
     envíos separados no funcionaría: comparten clave de idempotencia, así
     que el segundo se descartaría como repetido del primero. Van en un solo
     envío con varios destinatarios. */
  const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
  const destinos = (Array.isArray(para) ? para : [para])
    .map((d) => String(d ?? '').trim())
    .filter((d) => CORREO.test(d))

  if (!destinos.length) {
    return res.status(400).json({ error: 'Destinatario inválido' })
  }

  let compuesto
  try {
    compuesto = await componer(plantilla, datos ?? {})
  } catch (e) {
    console.error('correo: no se pudo componer', plantilla, e.message)
    return res.status(500).json({ error: 'No se pudo componer el correo' })
  }

  const resend = new Resend(clave)

  /* La clave de idempotencia es lo que impide que un pedido reciba el mismo
     correo tres veces. Mercado Pago reenvía su webhook varias veces por el
     mismo pago —lo comprobamos en la primera prueba con plata real— y cada
     reenvío llega aquí. Con la misma clave y el mismo contenido, Resend
     devuelve el envío original en vez de mandar otro.

     Dura 24 horas, que cubre de sobra la ventana de reintentos. */
  const idempotencia = `${plantilla}/${referencia ?? destinos.join(',')}`.slice(0, 256)

  /* El SDK de Resend NO lanza excepciones: devuelve { data, error }. Un
     try/catch aquí no atraparía nada y el fallo pasaría por bueno. */
  const { data, error } = await resend.emails.send(
    {
      from: REMITENTE,
      to: destinos,
      subject: compuesto.asunto,
      html: compuesto.html,
      text: compuesto.texto,
    },
    { idempotencyKey: idempotencia },
  )

  if (error) {
    console.error('correo: Resend rechazó el envío —', error.message)
    return res.status(502).json({ error: error.message })
  }

  console.log(`correo: ${plantilla} → ${destinos.map(enmascarar).join(', ')} · ${data.id}`)
  return res.status(200).json({ ok: true, id: data.id })
}

/** Comparación que tarda lo mismo acierte o falle. */
function iguales(a, b) {
  if (a.length !== b.length) return false
  let dif = 0
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return dif === 0
}

/** Para el log: saber a quién se le mandó sin dejar el correo entero escrito. */
function enmascarar(correo) {
  const [antes, dominio] = String(correo).split('@')
  return `${antes.slice(0, 2)}***@${dominio}`
}
