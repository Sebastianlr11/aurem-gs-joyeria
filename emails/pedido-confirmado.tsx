/**
 * "Recibimos tu pedido."
 *
 * Sale cuando Mercado Pago confirma el pago, y sirve para los dos casos: el
 * que pagó todo en línea y el que abonó el envío para un contraentrega. La
 * diferencia no es cosmética — al segundo le falta pagar el saldo en la
 * puerta, y ese número es lo más importante del correo. Sin él, la clienta
 * abre la puerta sin el efectivo listo y la entrega se cae.
 */
import * as React from 'react'
import { Body, Container, Head, Html, Preview, Section, Text } from '@react-email/components'
import {
  Antetitulo, Boton, Cabecera, Dato, Parrafo, Pie, Punzon, Titular,
  c, fuenteUI, pesos, SITIO,
} from './_marca'

export interface PedidoConfirmadoProps {
  nombre: string
  pieza: string
  referencia: string
  total: number
  /** Lo abonado. Sólo en contraentrega; si no viene, se pagó todo. */
  abono?: number | null
  ciudad: string
  direccion: string
}

export default function PedidoConfirmado({
  nombre, pieza, referencia, total, abono, ciudad, direccion,
}: PedidoConfirmadoProps) {
  const esAbono = abono != null && abono > 0
  const saldo = esAbono ? total - abono : 0
  const primerNombre = String(nombre || '').trim().split(/\s+/)[0]

  return (
    <Html lang="es">
      <Head />
      <Body style={{ margin: 0, padding: 0, background: c.arena }}>
        {/* Lo que se lee en la bandeja antes de abrir. En contraentrega se
            adelanta el saldo: es el dato que la clienta necesita recordar. */}
        <Preview>
          {esAbono
            ? `Tu ${pieza} queda confirmado. Al recibirlo pagas ${pesos(saldo)}.`
            : `Recibimos tu pago. Ya estamos preparando tu ${pieza}.`}
        </Preview>

        <Container style={{ maxWidth: '600px', margin: '0 auto', background: c.blanco }}>
          <Cabecera />

          <Section style={{ padding: '0 32px' }}>
            <Antetitulo>{esAbono ? 'Pedido confirmado' : 'Pago recibido'}</Antetitulo>
            <Titular>
              {esAbono ? 'Tu pieza entra al taller.' : 'Empezamos tu pieza.'}
            </Titular>

            <Parrafo>
              {primerNombre}, {esAbono
                ? `recibimos tu abono de ${pesos(abono)} y tu pedido queda confirmado.`
                : 'recibimos tu pago completo y tu pedido queda confirmado.'}{' '}
              Te escribimos por WhatsApp apenas se despache, con el número de guía.
            </Parrafo>
          </Section>

          <Section style={{ padding: '24px 32px 0' }}>
            <Dato etiqueta="Pieza">{pieza}</Dato>
            <Dato etiqueta="Referencia">{referencia}</Dato>
            <Dato etiqueta="Entrega">{direccion}, {ciudad}</Dato>

            {esAbono ? (
              <>
                <Dato etiqueta="Abonaste">{pesos(abono)} COP</Dato>
                {/* El saldo va en grande y de último. Es lo que tiene que
                    tener en efectivo cuando toquen la puerta. */}
                <Dato etiqueta="Pagas al recibir" fuerte>{pesos(saldo)} COP</Dato>
              </>
            ) : (
              <Dato etiqueta="Total pagado" fuerte>{pesos(total)} COP</Dato>
            )}
          </Section>

          {esAbono && (
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
                Ten listos <strong>{pesos(saldo)}</strong> en efectivo para el momento de la
                entrega. El domiciliario no da cambio de billetes grandes.
              </Text>
            </Section>
          )}

          {/* Sólo lo comprobable. El certificado no va: cuesta $50.000 aparte
              y prometerlo aquí sería el cobro sorpresa que evitamos en toda
              la web. */}
          <Section style={{ padding: '24px 32px 0' }}>
            <Punzon>Estuche incluido</Punzon>
            <Punzon>Garantía en el metal</Punzon>
          </Section>

          <Section style={{ padding: '28px 32px 0' }}>
            <Boton href={`${SITIO}/catalogo`}>Ver otras piezas</Boton>
          </Section>

          <Pie />
        </Container>
      </Body>
    </Html>
  )
}

PedidoConfirmado.PreviewProps = {
  nombre: 'María Fernanda Rodríguez',
  pieza: 'Anillo Majestuosa',
  referencia: 'AG-5647',
  total: 500000,
  abono: 20000,
  ciudad: 'Bogotá',
  direccion: 'Calle 93 # 13-24, apto 502',
} satisfies PedidoConfirmadoProps
