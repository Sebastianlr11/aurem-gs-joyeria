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
import { Body, Container, Head, Html, Preview, Section, Text } from '@react-email/components'
import {
  Antetitulo, Boton, Cabecera, Dato, Parrafo, Pie, Titular,
  c, fuenteUI, pesos,
} from './_marca'

export interface PedidoDespachadoProps {
  nombre: string
  pieza: string
  guia: string
  transportadora: string
  urlRastreo?: string | null
  ciudad: string
  /** Lo que falta por pagar en la puerta. Ausente si ya pagó todo. */
  saldo?: number | null
}

export default function PedidoDespachado({
  nombre, pieza, guia, transportadora, urlRastreo, ciudad, saldo,
}: PedidoDespachadoProps) {
  const porPagar = saldo != null && saldo > 0
  const primerNombre = String(nombre || '').trim().split(/\s+/)[0]
  const enBogota = /bogot/i.test(ciudad || '')

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

          <Section style={{ padding: '0 32px' }}>
            <Antetitulo>Pedido despachado</Antetitulo>
            <Titular>Tu pieza va en camino.</Titular>
            <Parrafo>
              {primerNombre}, tu {pieza} salió del taller.{' '}
              {enBogota
                ? 'En Bogotá llega entre 24 y 48 horas.'
                : 'Fuera de Bogotá llega entre 2 y 3 días.'}
            </Parrafo>
          </Section>

          <Section style={{ padding: '24px 32px 0' }}>
            <Dato etiqueta="Pieza">{pieza}</Dato>
            <Dato etiqueta="Transportadora">{transportadora}</Dato>
            <Dato etiqueta="Número de guía" fuerte>{guia}</Dato>
            {porPagar && <Dato etiqueta="Pagas al recibir" fuerte>{pesos(saldo)} COP</Dato>}
          </Section>

          {porPagar && (
            <Section style={{ padding: '20px 32px 0' }}>
              <Text
                style={{
                  margin: 0,
                  padding: '14px 16px',
                  background: c.marfil,
                  borderLeft: `3px solid ${c.oro}`,
                  fontFamily: fuenteUI,
                  fontSize: '14px',
                  lineHeight: '1.6',
                  color: c.ink,
                }}
              >
                Ten listos <strong>{pesos(saldo)}</strong> en efectivo. El domiciliario no da
                cambio de billetes grandes.
              </Text>
            </Section>
          )}

          {urlRastreo && (
            <Section style={{ padding: '28px 32px 0' }}>
              <Boton href={urlRastreo}>Rastrear el envío</Boton>
            </Section>
          )}

          <Section style={{ padding: '24px 32px 0' }}>
            <Parrafo>
              Cuando la recibas, revísala con calma. Si algo no está como esperabas,
              escríbenos el mismo día y lo resolvemos.
            </Parrafo>
          </Section>

          <Pie />
        </Container>
      </Body>
    </Html>
  )
}

PedidoDespachado.PreviewProps = {
  nombre: 'María Fernanda Rodríguez',
  pieza: 'Anillo Majestuosa',
  guia: '240071234567',
  transportadora: 'Interrapidísimo',
  urlRastreo: 'https://interrapidisimo.com/sigue-tu-envio/',
  ciudad: 'Bogotá',
  saldo: 480000,
} satisfies PedidoDespachadoProps
