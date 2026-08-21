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

export function Titular({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        margin: '14px 0 0',
        fontFamily: fuenteDisplay,
        fontSize: '28px',
        lineHeight: '1.15',
        color: c.ink,
      }}
    >
      {children}
    </Text>
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
    <span
      style={{
        display: 'inline-block',
        padding: '7px 12px',
        marginRight: '8px',
        border: `1px solid rgba(168,134,63,0.32)`,
        background: c.marfil,
        fontFamily: fuenteUI,
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.16em',
        textTransform: 'uppercase' as const,
        color: c.oroInk,
      }}
    >
      {children}
    </span>
  )
}

export function Boton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      style={{
        display: 'inline-block',
        boxSizing: 'border-box' as const,
        padding: '14px 28px',
        background: c.ink,
        color: c.blanco,
        fontFamily: fuenteUI,
        fontSize: '14px',
        fontWeight: 600,
        textDecoration: 'none',
        borderRadius: '100px',
      }}
    >
      {children}
    </a>
  )
}

/**
 * El pie, en cacao, como la única banda oscura del sitio. Lleva el WhatsApp
 * porque es donde de verdad contesta el negocio: un correo que no ofrece
 * cómo responder obliga a buscar el teléfono en otra parte.
 */
export function Pie() {
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
      <Text style={{ margin: '14px 0 0', fontFamily: fuenteUI, fontSize: '11px', color: '#7E736A' }}>
        Aurem Gs Joyería · Bogotá, Colombia ·{' '}
        <Link href={SITIO} style={{ color: '#7E736A' }}>
          auremgsjoyeria.com
        </Link>
      </Text>
    </Section>
  )
}
