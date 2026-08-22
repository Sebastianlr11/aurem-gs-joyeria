/**
 * La única puerta entre las plantillas y quien las manda.
 *
 * Existe para que la función de Vercel no tenga que tocar JSX. Las plantillas
 * son componentes React (.tsx) y la función es JavaScript plano; en vez de
 * confiar en que el compilador de Vercel resuelva esa mezcla —que puede
 * fallar en silencio y sólo al desplegar— se empaqueta este archivo con
 * esbuild antes de compilar, y la función importa el resultado ya masticado.
 *
 * Ver scripts/correos.mjs.
 */
import * as React from 'react'
import { render } from '@react-email/components'
import PedidoConfirmado from './pedido-confirmado'
import PedidoDespachado from './pedido-despachado'
import ChatEscalado from './chat-escalado'
import AlertaSistema from './alerta-sistema'

const PLANTILLAS = {
  'pedido-confirmado': PedidoConfirmado,
  'pedido-despachado': PedidoDespachado,
  'chat-escalado': ChatEscalado,
  'alerta-sistema': AlertaSistema,
} as const

export type Plantilla = keyof typeof PLANTILLAS

/** Los nombres válidos, para que la función pueda validar sin conocerlas. */
export const NOMBRES = Object.keys(PLANTILLAS) as Plantilla[]

/**
 * El asunto lo decide la plantilla, no quien la manda: es parte del mensaje.
 * En contraentrega lleva el saldo, que es lo que hay que recordar.
 */
export function asunto(plantilla: Plantilla, datos: Record<string, unknown>): string {
  const pieza = String(datos.pieza ?? 'tu pieza')
  const pesos = (n: unknown) => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`

  if (plantilla === 'alerta-sistema') {
    /* El asunto dice el problema, no "alerta del sistema". Se lee en la lista
       de la bandeja sin abrirlo, que es cuando se decide si urge. */
    const hs = (datos.hallazgos as Array<{ que: string }> | undefined) ?? []
    if (!hs.length) return 'Revisión del sistema'
    return hs.length === 1 ? hs[0].que : `${hs[0].que} (y ${hs.length - 1} más)`
  }

  if (plantilla === 'chat-escalado') {
    /* El asunto lleva el nombre porque este correo se lee en la lista, sin
       abrirlo: "Martín necesita que le respondas" dice más de un vistazo que
       "Una conversación necesita atención". */
    const quien = String(datos.nombre || '').trim() || String(datos.telefono || 'Un cliente')
    return `${quien} necesita que le respondas`
  }

  if (plantilla === 'pedido-despachado') {
    return `Tu ${pieza} va en camino`
  }
  const abono = Number(datos.abono ?? 0)
  return abono > 0
    ? `Pedido confirmado — al recibir pagas ${pesos(Number(datos.total) - abono)}`
    : `Recibimos tu pago — ${pieza}`
}

/** HTML y texto plano de una vez: los dos van en el mismo envío. */
export async function componer(plantilla: Plantilla, datos: Record<string, unknown>) {
  const C = PLANTILLAS[plantilla]
  if (!C) throw new Error(`Plantilla desconocida: ${plantilla}`)

  const elemento = React.createElement(C as React.ComponentType<any>, datos as any)
  /* El texto plano no es decorativo: hay clientes que sólo leen esa parte, y
     sin ella algunos filtros puntúan el correo como sospechoso. */
  const [html, texto] = await Promise.all([
    render(elemento),
    render(elemento, { plainText: true }),
  ])
  return { html, texto, asunto: asunto(plantilla, datos) }
}
