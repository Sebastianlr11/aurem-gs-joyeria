import { describe, it, expect } from 'vitest'
import { atribucionDelReferral, tieneComoAtribuirse } from './atribucionDelChat'

/**
 * Que una venta cerrada por WhatsApp vuelva a la campaña que la trajo.
 *
 * El joyero cierra desde su WhatsApp personal, así que la venta se registra
 * después a mano desde el chat. Si ese pedido sale sin el `ctwa_clid`, Meta no
 * puede acreditárselo al anuncio y la campaña sigue creyendo que no vende
 * nada — que es exactamente lo que pasó con la primera venta real.
 *
 * Se prueba porque el fallo es mudo: el pedido se crea, la cifra del panel
 * cuadra, y lo único que no ocurre es lo que no se ve.
 */
describe('la atribución que se saca del chat', () => {
  const REFERRAL = {
    source_type: 'ad',
    source_id: '120251419398080566',
    ctwa_clid: 'ARBc9v1lYqPaK',
    headline: 'Somos el taller, no la vitrina',
  }

  it('saca los dos identificadores que guarda el pedido', () => {
    expect(atribucionDelReferral(REFERRAL)).toEqual({
      ctwa_clid: 'ARBc9v1lYqPaK',
      anuncio_id: '120251419398080566',
    })
  })

  /* Una conversación orgánica no trae nada, y eso no es un error: es tráfico
     que no vino de un anuncio. El pedido se crea igual. */
  it('sin referral devuelve las dos en nulo, sin romperse', () => {
    for (const nada of [null, undefined, {}, 'texto', 42]) {
      expect(atribucionDelReferral(nada), String(nada))
        .toEqual({ ctwa_clid: null, anuncio_id: null })
    }
  })

  it('una cadena vacía o en blanco es lo mismo que no tenerla', () => {
    expect(atribucionDelReferral({ ctwa_clid: '', source_id: '   ' }))
      .toEqual({ ctwa_clid: null, anuncio_id: null })
  })

  /* Meta manda el `referral` también en publicaciones, no sólo en anuncios.
     Ahí hay `source_id` pero no `ctwa_clid`: se guarda lo que haya. */
  it('una publicación deja el anuncio y no el clic', () => {
    expect(atribucionDelReferral({ source_type: 'post', source_id: '99988877' }))
      .toEqual({ ctwa_clid: null, anuncio_id: '99988877' })
  })

  it('sólo el ctwa_clid sirve para que Meta acredite la venta', () => {
    expect(tieneComoAtribuirse({ ctwa_clid: 'ARBc9v1lYqPaK', anuncio_id: '1' })).toBe(true)
    /* Con el id del anuncio pero sin el clic, la venta se anota en el panel
       pero Meta no la puede juntar con nadie. La interfaz tiene que poder
       decirlo en vez de dar a entender que quedó atribuida. */
    expect(tieneComoAtribuirse({ ctwa_clid: null, anuncio_id: '120251419398080566' })).toBe(false)
    expect(tieneComoAtribuirse(null)).toBe(false)
  })
})
