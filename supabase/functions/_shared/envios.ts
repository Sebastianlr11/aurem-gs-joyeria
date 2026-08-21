/**
 * Las transportadoras y dónde se rastrea cada una.
 *
 * Vive aparte porque lo necesitan dos sitios que no se conocen entre sí: el
 * correo de despacho y la plantilla de WhatsApp. Tenerlo duplicado sería
 * garantizar que algún día el correo lleve a un lado y el WhatsApp a otro.
 *
 * Las tres direcciones están comprobadas contra el sitio real. La primera
 * versión las puse de memoria y dos de las tres daban 404 — y ese enlace lo
 * pulsa una clienta que ya pagó y está esperando su pieza.
 *
 * Ninguna lleva a la guía concreta: los enlaces directos de estas tres
 * cambian de forma cada tanto, y es mejor una página viva donde se pega el
 * número que un enlace exacto que se rompa en seis meses sin que nos
 * enteremos. Inter Rapidísimo va a su portada a propósito, porque el
 * buscador de guías está ahí mismo y no en una página aparte.
 */
const RASTREO: Record<string, { url: string; corto: string }> = {
  servientrega: {
    url: 'https://www.servientrega.com/wps/portal/rastreo-envio',
    corto: 'servientrega.com',
  },
  interrapidisimo: {
    url: 'https://www.interrapidisimo.com/',
    corto: 'interrapidisimo.com',
  },
  coordinadora: {
    url: 'https://coordinadora.com/rastreo/',
    corto: 'coordinadora.com',
  },
}

const sinTildes = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

/**
 * Dónde rastrea el cliente lo que va por esta transportadora.
 *
 * Devuelve null cuando no la reconocemos —"Otro", o el campo vacío—. Quien
 * llame decide qué hacer con eso: el correo esconde el botón, y la plantilla
 * de WhatsApp no se manda, porque su texto promete un sitio donde seguir el
 * envío y sin él prometería algo que no existe.
 */
export function rastreoDe(transportadora: string | null | undefined): { url: string; corto: string } | null {
  const clave = sinTildes(String(transportadora ?? ''))
  return RASTREO[clave] ?? null
}
