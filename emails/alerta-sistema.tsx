/**
 * "Algo se rompió."
 *
 * Este correo llega cuando el vigía encuentra un problema, y se lee en el
 * celular a las once de la noche. Así que no hay ceremonia: qué pasó, cuánto
 * de grave, y un botón al panel. Nada de tipografía de marca ni punzones —
 * eso es para las clientas, y aquí lo que hace falta es leerlo en tres
 * segundos y decidir si hay que levantarse.
 *
 * Sólo llega cuando algo está mal. Si llegara todos los días diciendo que
 * todo bien, nadie lo abriría el día que dijera otra cosa.
 */
import * as React from 'react'
import { Body, Container, Head, Html, Preview, Section } from '@react-email/components'
import { Boton, c, fuenteUI, SITIO } from './_marca'

export interface AlertaSistemaProps {
  hallazgos: Array<{ que: string; detalle?: string; grave?: boolean }>
  hora?: string | null
}

export default function AlertaSistema({ hallazgos, hora }: AlertaSistemaProps) {
  const lista = hallazgos?.length ? hallazgos : [{ que: 'Sin detalle' }]

  return (
    <Html lang="es">
      <Head />
      <Body style={{ margin: 0, padding: 0, background: c.arena }}>
        <Preview>{lista[0].que}</Preview>

        <Container style={{ maxWidth: '600px', margin: '0 auto', background: c.blanco }}>
          {/* Franja roja arriba: es lo único que se ve en la vista previa de
              la bandeja, y tiene que distinguirse de los correos de pedidos. */}
          <div style={{ background: '#8C2F1E', padding: '18px 32px' }}>
            <div style={{ fontFamily: fuenteUI, fontSize: '11px', lineHeight: '15px', letterSpacing: '0.2em', fontWeight: 700, color: '#F6E3DE' }}>
              REVISAR AHORA
            </div>
            <div style={{ fontFamily: fuenteUI, fontSize: '19px', lineHeight: '26px', fontWeight: 700, color: '#FFFFFF', paddingTop: '4px' }}>
              {lista.length === 1 ? 'Hay algo que no está funcionando' : `Hay ${lista.length} cosas que no están funcionando`}
            </div>
          </div>

          <Section style={{ padding: '26px 32px 0' }}>
            {lista.map((h, i) => (
              <table key={i} role="presentation" cellPadding={0} cellSpacing={0} border={0} width="100%"
                     style={{ width: '100%', marginBottom: '12px', background: c.marfil }}>
                <tbody>
                  <tr>
                    <td style={{ width: '3px', background: h.grave === false ? c.oro : '#8C2F1E' }}>&nbsp;</td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ fontFamily: fuenteUI, fontSize: '15px', lineHeight: '22px', fontWeight: 700, color: c.ink }}>
                        {h.que}
                      </div>
                      {h.detalle ? (
                        <div style={{ fontFamily: fuenteUI, fontSize: '13px', lineHeight: '20px', color: c.texto, paddingTop: '4px', wordBreak: 'break-word' }}>
                          {h.detalle}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                </tbody>
              </table>
            ))}
          </Section>

          <Section style={{ padding: '18px 32px 40px' }}>
            <table role="presentation" cellPadding={0} cellSpacing={0} border={0}>
              <tbody>
                <tr>
                  <Boton href={`${SITIO}/admin`}>Abrir el panel</Boton>
                </tr>
              </tbody>
            </table>
          </Section>

          <div style={{ borderTop: `1px solid ${c.filete}`, padding: '16px 32px 24px' }}>
            <p style={{ margin: 0, fontFamily: fuenteUI, fontSize: '11px', lineHeight: '18px', color: '#8A7F74' }}>
              Revisión automática{hora ? ` · ${hora}` : ''}. Este aviso sólo se manda cuando algo falla.
            </p>
          </div>
        </Container>
      </Body>
    </Html>
  )
}

AlertaSistema.PreviewProps = {
  hallazgos: [
    { que: '2 mensajes de WhatsApp no se entregaron', detalle: 'Tipo: image. Ejemplo: "Anillo Majestuosa — $500.000 COP"', grave: true },
    { que: '1 pago cobrado sin procesar', detalle: 'María Fernanda Rodríguez · $500.000', grave: true },
  ],
  hora: '21 de agosto, 8:00 p. m.',
} satisfies AlertaSistemaProps
