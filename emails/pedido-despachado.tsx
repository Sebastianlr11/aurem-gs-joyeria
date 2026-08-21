/**
 * "Tu pieza va en camino."
 *
 * Sale cuando el pedido se despacha, desde el panel del taller. Lo único que
 * de verdad importa aquí es el número de guía y dónde rastrearlo: todo lo
 * demás es acompañamiento.
 *
 * En contraentrega se repite el saldo. Es la segunda vez que se dice y es a
 * propósito: entre la confirmación y la entrega pueden pasar días, y nadie
 * recuerda una cifra de hace una semana con el domiciliario en la puerta.
 */
import * as React from 'react'
import { Body, Container, Head, Html, Preview, Section } from '@react-email/components'
import {
  Boton, BotonClaro, Cabecera, Dato, Nota, Pie, TarjetaPieza, Titular, Trazado,
  c, fuenteUI, pesos, WHATSAPP,
} from './_marca'

export interface PedidoDespachadoProps {
  nombre: string
  pieza: string
  referencia: string
  guia: string
  transportadora: string
  urlRastreo?: string | null
  ciudad: string
  /** Lo que falta por pagar en la puerta. Ausente si ya pagó todo. */
  saldo?: number | null
  imagen?: string | null
  ficha?: string | null
  fecha?: string | null
}

export default function PedidoDespachado({
  nombre, pieza, referencia, guia, transportadora, urlRastreo, ciudad, saldo, imagen, ficha, fecha,
}: PedidoDespachadoProps) {
  const porPagar = saldo != null && saldo > 0
  const primerNombre = String(nombre || '').trim().split(/\s+/)[0]
  const enBogota = /bogot/i.test(ciudad || '')
  const plazo = enBogota ? '24 a 48 horas' : '2 a 3 días'

  return (
    <Html lang="es">
      <Head />
      <Body style={{ margin: 0, padding: 0, background: c.arena }}>
        <Preview>
          {porPagar
            ? `Tu ${pieza} va en camino. Ten listos ${pesos(saldo)} en efectivo.`
            : `Tu ${pieza} va en camino. Guía ${guia}.`}
        </Preview>

        <Container style={{ maxWidth: '600px', margin: '0 auto', background: c.blanco }}>
          <Cabecera />

          <Section style={{ padding: '36px 40px 0' }}>
            <Titular antetitulo="Pedido despachado" primera="Tu pieza va" segunda="en camino." />
            <p style={{ margin: '16px 0 0', fontFamily: fuenteUI, fontSize: '16px', lineHeight: '26px', color: '#4A423C' }}>
              {primerNombre}, tu {pieza} salió del taller.{' '}
              {enBogota
                ? 'En Bogotá llega entre 24 y 48 horas.'
                : 'Fuera de Bogotá llega entre 2 y 3 días.'}
            </p>
          </Section>

          {/* El mismo trazado que la confirmación, un paso más adelante: la
              clienta ve que avanzó, no un correo suelto. */}
          <Trazado
            pasos={[
              { titulo: 'Pedido confirmado', pie: 'Listo', hecho: true },
              { titulo: 'En el taller', pie: 'Revisado y empacado', hecho: true },
              { titulo: 'En camino', pie: fecha ? `Desde el ${fecha}` : plazo, hecho: true },
            ]}
          />

          <TarjetaPieza nombre={pieza} detalle={[ficha, `ref. ${referencia}`].filter(Boolean).join(' · ')} imagen={imagen} />

          <Section style={{ padding: '28px 40px 0' }}>
            <Dato etiqueta="Transportadora">{transportadora}</Dato>
            <Dato etiqueta="Número de guía" fuerte>{guia}</Dato>
            <Dato etiqueta="Destino">{ciudad}</Dato>
          </Section>

          {porPagar && (
            <>
              <Section style={{ padding: '20px 40px 0' }}>
                <table role="presentation" cellPadding={0} cellSpacing={0} border={0} width="100%" style={{ width: '100%', background: c.arena }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '22px 24px', verticalAlign: 'middle' }}>
                        <div style={{ fontFamily: fuenteUI, fontSize: '10px', lineHeight: '14px', letterSpacing: '0.2em', fontWeight: 700, color: c.oroInk }}>
                          PAGAS AL RECIBIR
                        </div>
                        <div style={{ fontFamily: fuenteUI, fontSize: '13px', lineHeight: '20px', color: c.texto, paddingTop: '4px' }}>
                          En efectivo, al domiciliario
                        </div>
                      </td>
                      <td align="right" style={{ padding: '22px 24px', verticalAlign: 'middle', fontFamily: fuenteUI, fontSize: '30px', lineHeight: '34px', fontWeight: 700, color: c.ink, whiteSpace: 'nowrap' }}>
                        {pesos(saldo)} <span style={{ fontSize: '14px', fontWeight: 400, color: c.texto }}>COP</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </Section>
              <Nota>
                Ten listos <strong style={{ color: c.ink }}>{pesos(saldo)}</strong> en efectivo: el
                domiciliario no da cambio de billetes grandes.
              </Nota>
            </>
          )}

          <Section style={{ padding: '30px 40px 0' }}>
            <table role="presentation" cellPadding={0} cellSpacing={0} border={0}>
              <tbody>
                <tr>
                  {urlRastreo && <Boton href={urlRastreo}>Rastrear el envío</Boton>}
                  {urlRastreo && <td width={12} style={{ width: '12px', fontSize: 0, lineHeight: 0 }}>&nbsp;</td>}
                  <BotonClaro href={WHATSAPP}>Escribir por WhatsApp</BotonClaro>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section style={{ padding: '24px 40px 46px' }}>
            <p style={{ margin: 0, fontFamily: fuenteUI, fontSize: '15px', lineHeight: '25px', color: c.texto }}>
              Cuando la recibas, revísala con calma. Si algo no está como esperabas, escríbenos el
              mismo día y lo resolvemos.
            </p>
          </Section>

          <Pie referencia={referencia} />
        </Container>

        <div style={{ textAlign: 'center', fontFamily: fuenteUI, fontSize: '11px', lineHeight: '18px', color: '#8A7F74', padding: '18px 12px 32px' }}>
          Pedido {referencia}
          {fecha ? ` · ${fecha}` : ''}
        </div>
      </Body>
    </Html>
  )
}

PedidoDespachado.PreviewProps = {
  nombre: 'María Fernanda Rodríguez',
  pieza: 'Anillo Majestuosa',
  referencia: 'AG-5647',
  guia: '240071234567',
  transportadora: 'Interrapidísimo',
  urlRastreo: 'https://interrapidisimo.com/sigue-tu-envio/',
  ciudad: 'Bogotá',
  saldo: 480000,
  imagen: null,
  ficha: 'Plata 925 · esmeralda natural',
  fecha: '21 de agosto de 2026',
} satisfies PedidoDespachadoProps
