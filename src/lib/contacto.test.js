import { describe, it, expect } from 'vitest'
import { esTelefono, nombreVisible, inicialDe } from './contacto'
import { esTelefono as esTelefonoDeValentina } from '../../supabase/functions/_shared/reglas'

/**
 * Cómo se llama en pantalla quien escribe por WhatsApp.
 *
 * La mitad de este archivo no comprueba código: compara dos copias. `esTelefono`
 * está escrito en `src/lib/contacto.js` para el panel y en
 * `_shared/reglas.ts` para Valentina, porque corren en runtimes distintos.
 * Si dejan de coincidir, el panel enseña como teléfono algo que la base guardó
 * como `wa_id` —o al revés—, y el fallo es mudo: la fila se pinta, el chat se
 * abre, y lo único que pasa es que el número que se lee en voz alta no existe.
 */
describe('el teléfono, comparado con la copia de Valentina', () => {
  const CASOS = [
    '3143602930', '+573143602930', '573143602930', '(314) 360-2930',
    '314 360 2930', '+57 314 360 2930', '3143602930 ',
    'CO.1287538963396593', 'CO.38364', 'co.1287538963396593',
    '', '   ', null, undefined, 0, 42, {}, [],
    '123456789', '1234567890', '1234567890123456', '+',
    '300-000-0000', 'tres uno cuatro', '57 (1) 2345678',
  ]

  it('las dos copias dicen lo mismo, entrada por entrada', () => {
    for (const c of CASOS) {
      expect(esTelefono(c), `desacuerdo en ${JSON.stringify(c)}`)
        .toBe(esTelefonoDeValentina(c))
    }
  })

  it('y lo que dicen es lo correcto', () => {
    for (const si of ['3143602930', '+573143602930', '(314) 360-2930'])
      expect(esTelefono(si), si).toBe(true)
    /* Los identificadores de Meta traen letras y un punto: por ahí se
       distinguen. Que hoy ninguno choque con un móvil colombiano es suerte,
       no diseño — ver CLAUDE.md §11. */
    for (const no of ['CO.1287538963396593', '', '   ', null, '123456789'])
      expect(esTelefono(no), String(no)).toBe(false)
  })
})

describe('con qué dos líneas se pinta un contacto', () => {
  it('con nombre y teléfono, el número va debajo para poder marcar', () => {
    expect(nombreVisible({ customer_name: 'Duverney', phone_number: '573212173881' }))
      .toEqual({ nombre: 'Duverney', detalle: '573212173881', anonimo: false })
  })

  /* El identificador de Meta no se puede marcar ni buscar: enseñarlo de
     subtítulo era ocupar la línea con algo que no sirve para nada. */
  it('con nombre pero sin teléfono, no se enseña el identificador', () => {
    expect(nombreVisible({ customer_name: 'Naidu', phone_number: 'CO.1287538963396593' }))
      .toEqual({ nombre: 'Naidu', detalle: null, anonimo: false })
  })

  it('sin nombre pero con teléfono, el número es el nombre', () => {
    expect(nombreVisible({ customer_name: null, phone_number: '3153921557' }))
      .toEqual({ nombre: '3153921557', detalle: null, anonimo: false })
  })

  /* La fila que más importa: es un lead que llegó por un anuncio. Antes se
     leía «CO.38364…», indistinguible de un error del sistema. */
  it('sin nombre y sin teléfono, se dice de dónde llegó', () => {
    expect(nombreVisible({ customer_name: null, phone_number: 'CO.1287538963396593' }))
      .toEqual({ nombre: 'Sin nombre', detalle: 'Llegó por Instagram o Facebook', anonimo: true })
  })

  it('nunca devuelve un nombre vacío, pase lo que pase', () => {
    for (const nada of [null, undefined, {}, { customer_name: '   ', phone_number: '' }])
      expect(nombreVisible(nada).nombre, String(nada)).toBeTruthy()
  })

  it('la inicial del avatar sólo sale si significa algo', () => {
    expect(inicialDe({ customer_name: 'duverney' })).toBe('D')
    expect(inicialDe({ customer_name: 'Ñandú' })).toBe('Ñ')
    /* Un número no da inicial, y `CO.…` tampoco: sería una «C» idéntica en
       todos ellos, que es peor que el icono de persona. */
    expect(inicialDe({ phone_number: '3153921557' })).toBe(null)
    expect(inicialDe({ phone_number: 'CO.1287538963396593' })).toBe(null)
    expect(inicialDe({ customer_name: '🌺 Naidu' })).toBe(null)
  })
})
