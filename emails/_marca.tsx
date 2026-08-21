/**
 * La marca, una sola vez, para las tres plantillas.
 *
 * El correo no puede compartir la hoja de estilos del sitio: cada cliente de
 * correo recorta el CSS a su gusto y Gmail borra los <style> externos. Así que
 * los mismos tokens de src/index.css viven aquí otra vez, ya en línea. Si
 * cambia un color de marca hay que tocarlo en los dos sitios — no hay forma de
 * evitarlo sin un paso de compilación que no compensa por tres plantillas.
 *
 * Tampoco hay tipografía de marca: Marcellus y Mulish no cargan en Outlook ni
 * en Gmail de escritorio, y una fuente que sólo se ve en la mitad de los
 * buzones es peor que una del sistema bien elegida. Georgia hace de romana
 * —es la que más se parece a Marcellus de las que están en todas partes— y
 * el resto va en la sans del sistema.
 */
import * as React from 'react'
import { Column, Hr, Img, Link, Row, Section, Text } from '@react-email/components'

export const SITIO = 'https://www.auremgsjoyeria.com'
export const WHATSAPP = 'https://wa.me/573115761896'
export const CORREO = 'hola@auremgsjoyeria.com'

export const c = {
  ink: '#1C1714',        // cacao
  inkSuave: '#2A231E',
  marfil: '#FBF7F2',
  blanco: '#FFFFFF',
  arena: '#F2EAE0',
  oro: '#A8863F',
  oroInk: '#7A5F26',     // el oro que sí cumple contraste sobre claro
  oroLuz: '#E3C990',     // el oro que se lee sobre cacao
  texto: '#6B615A',
  filete: '#E6DED3',
}

export const fuenteUI =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
export const fuenteDisplay = "Georgia, 'Times New Roman', serif"

/** Pesos en formato colombiano. Nunca se muestra un número pelado. */
export const pesos = (n: number | string) =>
  `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`

/* ─── Piezas ──────────────────────────────────────────────────────── */

export function Cabecera() {
  return (
    <Section style={{ padding: '32px 32px 24px', textAlign: 'center' as const }}>
      <Text
        style={{
          margin: 0,
          fontFamily: fuenteDisplay,
          fontSize: '22px',
          letterSpacing: '0.18em',
          textTransform: 'uppercase' as const,
          color: c.ink,
        }}
      >
        Aurem Gs
      </Text>
      <Text
        style={{
          margin: '6px 0 0',
          fontFamily: fuenteUI,
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.24em',
          textTransform: 'uppercase' as const,
          color: c.oroInk,
        }}
      >
        Joyería
      </Text>
    </Section>
  )
}

/**
 * El antetítulo del sistema de diseño: filete de oro y etiqueta en
 * versalitas. Es lo que ata el correo con el sitio de un vistazo.
 */
export function Antetitulo({ children }: { children: React.ReactNode }) {
  return (
    <Row>
      <Column style={{ width: '32px', verticalAlign: 'middle' as const }}>
        <div style={{ height: '1px', background: c.oro, width: '32px' }} />
      </Column>
      <Column style={{ verticalAlign: 'middle' as const, paddingLeft: '12px' }}>
        <Text
          style={{
            margin: 0,
            fontFamily: fuenteUI,
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.24em',
            textTransform: 'uppercase' as const,
            color: c.oroInk,
          }}
        >
          {children}
        </Text>
      </Column>
    </Row>
  )
}

/**
 * El titular parte en dos, como en el sitio: la primera línea en romana
 * grande y la segunda en versalitas espaciadas. Es el gesto que más ata el
 * correo con la web, y el que hace que se reconozca la marca antes de leer.
 */
export function Titular({
  antetitulo, primera, segunda,
}: { antetitulo: string; primera: string; segunda: string }) {
  return (
    <>
      <table role="presentation" cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          <tr>
            <td width={28} style={{ width: '28px', borderTop: `1px solid ${c.oro}`, fontSize: 0, lineHeight: 0 }}>&nbsp;</td>
            <td style={{ paddingLeft: '12px', fontFamily: fuenteUI, fontSize: '10px', lineHeight: '12px', letterSpacing: '0.24em', fontWeight: 700, color: c.oroInk, textTransform: 'uppercase' as const }}>
              {antetitulo}
            </td>
          </tr>
        </tbody>
      </table>
      <div style={{ paddingTop: '18px', fontFamily: fuenteDisplay, fontSize: '40px', lineHeight: '46px', color: c.ink }}>
        {primera}
        <br />
        <span style={{ fontSize: '26px', lineHeight: '46px', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
          {segunda}
        </span>
      </div>
    </>
  )
}

export function Parrafo({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        margin: '14px 0 0',
        fontFamily: fuenteUI,
        fontSize: '15px',
        lineHeight: '1.65',
        color: c.texto,
      }}
    >
      {children}
    </Text>
  )
}

/** Una fila de la ficha: etiqueta a la izquierda, valor a la derecha. */
export function Dato({
  etiqueta,
  children,
  fuerte,
}: {
  etiqueta: string
  children: React.ReactNode
  fuerte?: boolean
}) {
  return (
    <Row style={{ borderBottom: `1px solid ${c.filete}` }}>
      <Column style={{ padding: '12px 0', verticalAlign: 'top' as const }}>
        <Text
          style={{
            margin: 0,
            fontFamily: fuenteUI,
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.16em',
            textTransform: 'uppercase' as const,
            color: c.oroInk,
          }}
        >
          {etiqueta}
        </Text>
      </Column>
      <Column
        style={{ padding: '12px 0', textAlign: 'right' as const, verticalAlign: 'top' as const }}
      >
        <Text
          style={{
            margin: 0,
            fontFamily: fuenteUI,
            fontSize: fuerte ? '17px' : '14px',
            fontWeight: fuerte ? 700 : 400,
            lineHeight: '1.5',
            color: fuerte ? c.ink : c.texto,
          }}
        >
          {children}
        </Text>
      </Column>
    </Row>
  )
}

/**
 * El punzón del sistema de diseño, adaptado. En el sitio lleva un clip-path
 * hexagonal; aquí no, porque clip-path no existe en la mitad de los clientes
 * de correo. Se conserva lo que sí viaja: el borde de oro, las versalitas
 * espaciadas y el fondo claro.
 */
export function Punzon({ children }: { children: React.ReactNode }) {
  return (
    <td
      style={{
        border: `1px solid ${c.filete}`,
        padding: '9px 14px',
        fontFamily: fuenteUI,
        fontSize: '10px',
        lineHeight: '12px',
        letterSpacing: '0.16em',
        fontWeight: 700,
        textTransform: 'uppercase' as const,
        color: c.oroInk,
      }}
    >
      {children}
    </td>
  )
}

export function Boton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <td align="center" bgcolor={c.ink} style={{ background: c.ink, borderRadius: '100px' }}>
      <a
        href={href}
        style={{
          display: 'block',
          padding: '15px 30px',
          fontFamily: fuenteUI,
          fontSize: '15px',
          lineHeight: '18px',
          fontWeight: 700,
          color: c.marfil,
          textDecoration: 'none',
          borderRadius: '100px',
        }}
      >
        {children}
      </a>
    </td>
  )
}

/**
 * El pie, en cacao, como la única banda oscura del sitio. Lleva el WhatsApp
 * porque es donde de verdad contesta el negocio: un correo que no ofrece
 * cómo responder obliga a buscar el teléfono en otra parte.
 */
export function Pie({ referencia }: { referencia?: string | null }) {
  return (
    <Section
      style={{
        background: c.ink,
        padding: '28px 32px',
        marginTop: '32px',
      }}
    >
      <Text
        style={{
          margin: 0,
          fontFamily: fuenteDisplay,
          fontSize: '15px',
          lineHeight: '1.55',
          color: c.oroLuz,
        }}
      >
        Piezas hechas a mano en Colombia, para durar generaciones.
      </Text>
      <Hr style={{ borderColor: 'rgba(227,201,144,0.24)', margin: '20px 0' }} />
      <Text style={{ margin: 0, fontFamily: fuenteUI, fontSize: '13px', lineHeight: '1.7', color: '#B9AEA4' }}>
        ¿Alguna duda con tu pedido?{' '}
        <Link href={WHATSAPP} style={{ color: c.oroLuz, textDecoration: 'underline' }}>
          Escríbenos por WhatsApp
        </Link>{' '}
        o responde a este correo.
      </Text>
      <Text style={{ margin: '22px 0 0', fontFamily: fuenteUI, fontSize: '12px', lineHeight: '20px', color: '#8A7F74' }}>
        Aurem Gs Joyería · Bogotá, Colombia ·{' '}
        <Link href={SITIO} style={{ color: '#8A7F74', textDecoration: 'none' }}>
          auremgsjoyeria.com
        </Link>
        {referencia && (
          <>
            <br />
            {/* Por qué le llega esto. Un correo transaccional que no dice de
                dónde sale se parece demasiado a uno no solicitado. */}
            Recibes este correo porque hiciste el pedido {referencia}.
          </>
        )}
      </Text>
    </Section>
  )
}

/**
 * Los tres pasos del pedido. No es decoración: dice dónde está la pieza sin
 * que haya que leer un párrafo, y sobre todo dice que hay un proceso detrás —
 * que es justo lo que separa una tienda seria de un chat.
 *
 * Con filete de oro los pasos hechos y de pelo el que falta.
 */
export function Trazado({
  pasos,
}: {
  pasos: { titulo: string; pie: string; hecho: boolean }[]
}) {
  return (
    <Section style={{ padding: '32px 40px 0' }}>
      <table role="presentation" cellPadding={0} cellSpacing={0} border={0} width="100%" style={{ width: '100%' }}>
        <tbody>
          <tr>
            {pasos.map((p, i) => (
              <td
                key={p.titulo}
                width="33%"
                style={{
                  width: '33.33%',
                  verticalAlign: 'top' as const,
                  borderTop: `2px solid ${p.hecho ? c.oro : c.filete}`,
                  padding: i === 0 ? '12px 12px 0 0' : i === pasos.length - 1 ? '12px 0 0 12px' : '12px 12px 0 12px',
                }}
              >
                <div style={{ fontFamily: fuenteUI, fontSize: '10px', lineHeight: '14px', letterSpacing: '0.16em', fontWeight: 700, textTransform: 'uppercase' as const, color: p.hecho ? c.oroInk : c.texto }}>
                  {p.titulo}
                </div>
                <div style={{ fontFamily: fuenteUI, fontSize: '13px', lineHeight: '20px', color: c.texto, paddingTop: '4px' }}>
                  {p.pie}
                </div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </Section>
  )
}

/**
 * La pieza, con su foto. La foto es la de verdad, la misma del catálogo: en
 * una joyería el producto es la mitad del mensaje, y una tarjeta con el
 * nombre a secas se lee como una factura. Si falta, queda el rombo de la
 * marca en vez de un hueco roto.
 */
export function TarjetaPieza({
  nombre, detalle, imagen,
}: { nombre: string; detalle?: string | null; imagen?: string | null }) {
  return (
    <Section style={{ padding: '32px 40px 0' }}>
      <table role="presentation" cellPadding={0} cellSpacing={0} border={0} width="100%" style={{ width: '100%', background: c.marfil, border: `1px solid ${c.filete}` }}>
        <tbody>
          <tr>
            <td width={120} align="center" style={{ width: '120px', height: '150px', background: c.arena, verticalAlign: 'middle' as const }}>
              {imagen ? (
                <Img src={imagen} alt={nombre} width="120" height="150" style={{ display: 'block', width: '120px', height: '150px', objectFit: 'cover' as const }} />
              ) : (
                <span style={{ fontFamily: fuenteDisplay, fontSize: '22px', color: c.oro }}>&#10022;</span>
              )}
            </td>
            <td style={{ padding: '20px 20px 20px 22px', verticalAlign: 'middle' as const }}>
              <div style={{ fontFamily: fuenteDisplay, fontSize: '22px', lineHeight: '28px', color: c.ink }}>{nombre}</div>
              {detalle && (
                <div style={{ fontFamily: fuenteUI, fontSize: '14px', lineHeight: '22px', color: c.texto, paddingTop: '6px' }}>
                  {detalle}
                </div>
              )}
              <div style={{ fontFamily: fuenteUI, fontSize: '10px', lineHeight: '14px', letterSpacing: '0.16em', fontWeight: 700, color: c.oroInk, paddingTop: '14px' }}>
                CON PUNZÓN DE LEY
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  )
}

/** El aviso al margen: filete de oro a la izquierda sobre fondo marfil. */
export function Nota({ children }: { children: React.ReactNode }) {
  return (
    <Section style={{ padding: '12px 40px 0' }}>
      <table role="presentation" cellPadding={0} cellSpacing={0} border={0} width="100%" style={{ width: '100%' }}>
        <tbody>
          <tr>
            <td width={3} style={{ width: '3px', background: c.oro, fontSize: 0, lineHeight: 0 }}>&nbsp;</td>
            <td style={{ padding: '14px 18px', background: c.marfil, fontFamily: fuenteUI, fontSize: '14px', lineHeight: '22px', color: '#4A423C' }}>
              {children}
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  )
}

/** El botón secundario: contorno de oro, sin relleno. */
export function BotonClaro({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <td align="center" style={{ border: `1px solid ${c.oro}`, borderRadius: '100px' }}>
      <a href={href} style={{ display: 'block', padding: '14px 28px', fontFamily: fuenteUI, fontSize: '15px', lineHeight: '18px', fontWeight: 700, color: c.oroInk, textDecoration: 'none', borderRadius: '100px' }}>
        {children}
      </a>
    </td>
  )
}
