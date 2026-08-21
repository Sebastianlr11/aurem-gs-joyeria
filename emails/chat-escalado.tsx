/**
 * "Una conversación necesita a una persona."
 *
 * Este correo no va a un cliente: va al taller. Y eso cambia todo lo que
 * importa. Un correo de marca se lee con calma; este se abre en el celular
 * mientras se hace otra cosa, y tiene que contestar en dos segundos qué pasó
 * y si hay que soltar lo que se está haciendo.
 *
 * Por eso lleva la cabecera de la marca pero no el resto del ceremonial: sin
 * punzones, sin trazado, sin pie de garantía. Lo que se ve primero es quién
 * escribió y qué pidió; el botón lleva directo al panel.
 *
 * Existe porque hasta ahora Valentina decía "te comunico con alguien del
 * equipo" y nadie se enteraba. El cliente quedaba esperando a una persona que
 * no sabía que la estaban esperando.
 */
import * as React from 'react'
import { Body, Container, Head, Html, Preview, Section } from '@react-email/components'
import { Boton, Cabecera, Dato, c, fuenteUI, fuenteDisplay, SITIO } from './_marca'

export interface ChatEscaladoProps {
  /** Cómo se llama, si lo alcanzó a decir. */
  nombre?: string | null
  telefono: string
  /** Por qué Valentina no pudo seguir. Lo escribe ella, para el equipo. */
  motivo: string
  /** Los últimos mensajes, del más viejo al más nuevo. */
  ultimos?: Array<{ de: 'cliente' | 'valentina'; texto: string }>
  hora?: string | null
}

export default function ChatEscalado({ nombre, telefono, motivo, ultimos, hora }: ChatEscaladoProps) {
  const quien = String(nombre || '').trim() || telefono

  return (
    <Html lang="es">
      <Head />
      <Body style={{ margin: 0, padding: 0, background: c.arena }}>
        <Preview>{`${quien} necesita que le responda una persona`}</Preview>

        <Container style={{ maxWidth: '600px', margin: '0 auto', background: c.blanco }}>
          <Cabecera />

          <Section style={{ padding: '32px 32px 0' }}>
            <div style={{ fontFamily: fuenteUI, fontSize: '10px', lineHeight: '14px', letterSpacing: '0.2em', fontWeight: 700, color: c.oroInk }}>
              ATENCIÓN HUMANA
            </div>
            <h1 style={{ margin: '10px 0 0', fontFamily: fuenteDisplay, fontSize: '28px', lineHeight: '34px', fontWeight: 400, color: c.ink }}>
              {quien} necesita que le respondas
            </h1>
            <p style={{ margin: '12px 0 0', fontFamily: fuenteUI, fontSize: '15px', lineHeight: '24px', color: '#4A423C' }}>
              Valentina ya le dijo que alguien del equipo le escribe. Está esperando.
            </p>
          </Section>

          <Section style={{ padding: '24px 32px 0' }}>
            <Dato etiqueta="Teléfono">{telefono}</Dato>
            <Dato etiqueta="Por qué se pasó">{motivo}</Dato>
            {hora && <Dato etiqueta="Cuándo">{hora}</Dato>}
          </Section>

          {/* Los últimos mensajes tal cual. Sin esto habría que abrir el panel
              sólo para saber si corre prisa, y el correo no habría servido de
              nada más que para avisar de que hay que mirar en otro sitio. */}
          {!!ultimos?.length && (
            <Section style={{ padding: '22px 32px 0' }}>
              <table role="presentation" cellPadding={0} cellSpacing={0} border={0} width="100%" style={{ width: '100%', background: c.marfil }}>
                <tbody>
                  {ultimos.map((m, i) => (
                    <tr key={i}>
                      <td style={{ padding: i === 0 ? '18px 20px 6px' : '6px 20px', verticalAlign: 'top' }}>
                        <div style={{ fontFamily: fuenteUI, fontSize: '10px', lineHeight: '14px', letterSpacing: '0.16em', fontWeight: 700, color: m.de === 'cliente' ? c.oroInk : '#8A7F74' }}>
                          {m.de === 'cliente' ? quien.toUpperCase() : 'VALENTINA'}
                        </div>
                        <div style={{ fontFamily: fuenteUI, fontSize: '14px', lineHeight: '21px', color: c.texto, paddingTop: '3px' }}>
                          {m.texto}
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr><td style={{ height: '14px', fontSize: 0, lineHeight: 0 }}>&nbsp;</td></tr>
                </tbody>
              </table>
            </Section>
          )}

          <Section style={{ padding: '26px 32px 40px' }}>
            <table role="presentation" cellPadding={0} cellSpacing={0} border={0}>
              <tbody>
                <tr>
                  <Boton href={`${SITIO}/admin/chats`}>Abrir la conversación</Boton>
                </tr>
              </tbody>
            </table>
          </Section>

          <div style={{ borderTop: `1px solid ${c.filete}`, padding: '18px 32px 26px' }}>
            <p style={{ margin: 0, fontFamily: fuenteUI, fontSize: '11px', lineHeight: '18px', color: '#8A7F74' }}>
              Recibes este aviso porque tienes acceso al panel de Aurem Gs.
            </p>
          </div>
        </Container>
      </Body>
    </Html>
  )
}

ChatEscalado.PreviewProps = {
  nombre: 'Martín Maestre',
  telefono: '573143602930',
  motivo: 'Pide cotización de un anillo en plata con piedra negra, a partir de una foto. La plata y las piedras las cotiza una persona.',
  ultimos: [
    { de: 'cliente', texto: '📷 Anillo ancho plateado con piedra redonda negra y detalles calados. "estoy buscando algo así, en cuánto saldría"' },
    { de: 'valentina', texto: 'Vi la foto, un anillo ancho con piedra negra. Eso lo cotiza el taller, te comunico con alguien del equipo.' },
  ],
  hora: '21 de agosto, 4:50 p. m.',
} satisfies ChatEscaladoProps
