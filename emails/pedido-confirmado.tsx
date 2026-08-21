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
import { Body, Container, Head, Html, Preview, Section } from '@react-email/components'
import {
  Boton, BotonClaro, Cabecera, Dato, Nota, Pie, Punzon, TarjetaPieza, Titular, Trazado,
  c, fuenteUI, pesos, SITIO, WHATSAPP,
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
  /** La foto real de la pieza. Sin ella queda el rombo de la marca. */
  imagen?: string | null
  /** "Oro 18k · esmeralda natural", tal como en la ficha. */
  ficha?: string | null
  talla?: string | null
  fecha?: string | null
}

export default function PedidoConfirmado({
  nombre, pieza, referencia, total, abono, ciudad, direccion, imagen, ficha, talla, fecha,
}: PedidoConfirmadoProps) {
  const esAbono = abono != null && abono > 0
  const saldo = esAbono ? total - abono : 0
  const primerNombre = String(nombre || '').trim().split(/\s+/)[0]
  const enBogota = /bogot/i.test(ciudad || '')

  /* El plazo depende de a dónde va. El diseño traía "24 a 48 horas hábiles"
     fijo, y eso sólo es cierto en Bogotá: al resto del país la transportadora
     tarda de 2 a 3 días. */
  const plazo = enBogota ? '24 a 48 horas' : '2 a 3 días'

  const detalle = [ficha, talla ? `talla ${talla}` : null, `ref. ${referencia}`]
    .filter(Boolean).join(' · ')

  return (
    <Html lang="es">
      <Head />
      <Body style={{ margin: 0, padding: 0, background: c.arena }}>
        <Preview>
          {esAbono
            ? `Recibimos tu abono de ${pesos(abono)}. Al recibir la pieza pagas ${pesos(saldo)}.`
            : `Recibimos tu pago. Ya estamos preparando tu ${pieza}.`}
        </Preview>

        <Container style={{ maxWidth: '600px', margin: '0 auto', background: c.blanco }}>
          <Cabecera />

          <Section style={{ padding: '36px 32px 0' }}>
            <Titular
              antetitulo={esAbono ? 'Pedido confirmado' : 'Pago recibido'}
              primera={esAbono ? 'Tu pieza entra' : 'Empezamos'}
              segunda={esAbono ? 'al taller.' : 'tu pieza.'}
            />
            <p
              style={{
                margin: '16px 0 0',
                fontFamily: fuenteUI,
                fontSize: '15px',
                lineHeight: '24px',
                color: '#4A423C',
              }}
            >
              {primerNombre}, {esAbono
                ? `recibimos tu abono de ${pesos(abono)} y tu pedido queda confirmado.`
                : 'recibimos tu pago completo y tu pedido queda confirmado.'}{' '}
              Te escribimos por WhatsApp apenas se despache, con el número de guía.
            </p>
          </Section>

          <Trazado
            pasos={[
              { titulo: esAbono ? 'Abono recibido' : 'Pago recibido', pie: fecha || 'Hoy', hecho: true },
              { titulo: 'En el taller', pie: 'Revisión y empaque', hecho: true },
              { titulo: 'En camino', pie: plazo, hecho: false },
            ]}
          />

          <TarjetaPieza nombre={pieza} detalle={detalle} imagen={imagen} />

          <Section style={{ padding: '28px 32px 0' }}>
            <Dato etiqueta="Entrega">{direccion}, {ciudad}</Dato>
            {esAbono && <Dato etiqueta="Abonaste">{pesos(abono)} <small style={{ fontSize: '12px', color: c.texto }}>COP</small></Dato>}
          </Section>

          {/* El bloque grande. En contraentrega es el saldo que va a pagar en
              la puerta; si ya pagó todo, es el recibo de lo que pagó. */}
          <Section style={{ padding: '20px 32px 0' }}>
            <table role="presentation" cellPadding={0} cellSpacing={0} border={0} width="100%" style={{ width: '100%', background: c.arena }}>
              <tbody>
                <tr>
                  <td style={{ padding: '22px 24px', verticalAlign: 'middle' }}>
                    <div style={{ fontFamily: fuenteUI, fontSize: '10px', lineHeight: '14px', letterSpacing: '0.2em', fontWeight: 700, color: c.oroInk }}>
                      {esAbono ? 'PAGAS AL RECIBIR' : 'TOTAL PAGADO'}
                    </div>
                    <div style={{ fontFamily: fuenteUI, fontSize: '13px', lineHeight: '20px', color: c.texto, paddingTop: '4px' }}>
                      {esAbono ? 'En efectivo, al domiciliario' : 'Pago confirmado'}
                    </div>
                  </td>
                  <td align="right" style={{ padding: '22px 24px', verticalAlign: 'middle', fontFamily: fuenteUI, fontSize: '26px', lineHeight: '30px', fontWeight: 700, color: c.ink, whiteSpace: 'nowrap' }}>
                    {pesos(esAbono ? saldo : total)}{' '}
                    <span style={{ fontSize: '14px', fontWeight: 400, color: c.texto }}>COP</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          {esAbono && (
            <Nota>
              Ten listos <strong style={{ color: c.ink }}>{pesos(saldo)}</strong> en efectivo para el
              momento de la entrega: el domiciliario no da cambio de billetes grandes.
            </Nota>
          )}

          {/* Sólo lo comprobable. El certificado gemológico NO va: cuesta
              $50.000 aparte y prometerlo aquí sería el cobro sorpresa que
              evitamos en toda la web. El punzón de ley sí — va grabado en el
              metal de cada pieza. */}
          <Section style={{ padding: '24px 32px 0' }}>
            <table role="presentation" cellPadding={0} cellSpacing={0} border={0}>
              <tbody>
                <tr>
                  <Punzon>Estuche incluido</Punzon>
                  <td width={10} style={{ width: '10px', fontSize: 0, lineHeight: 0 }}>&nbsp;</td>
                  <Punzon>Garantía en el metal</Punzon>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section style={{ padding: '30px 32px 46px' }}>
            <table role="presentation" cellPadding={0} cellSpacing={0} border={0}>
              <tbody>
                <tr>
                  <Boton href={`${SITIO}/catalogo`}>Ver el catálogo</Boton>
                  <td width={12} style={{ width: '12px', fontSize: 0, lineHeight: 0 }}>&nbsp;</td>
                  <BotonClaro href={WHATSAPP}>Escribir por WhatsApp</BotonClaro>
                </tr>
              </tbody>
            </table>
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

PedidoConfirmado.PreviewProps = {
  nombre: 'María Fernanda Rodríguez',
  pieza: 'Anillo Majestuosa',
  referencia: 'AG-5647',
  total: 500000,
  abono: 20000,
  ciudad: 'Bogotá',
  direccion: 'Calle 26 Sur 79A 38',
  imagen: null,
  ficha: 'Plata 925 · esmeralda natural',
  talla: '14',
  fecha: '21 de agosto de 2026',
} satisfies PedidoConfirmadoProps
