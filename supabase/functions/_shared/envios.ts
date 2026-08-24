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
  /* Las dos que trae 99envios y el panel no conocía. Comprobadas con curl el
     24 de agosto de 2026, por lo de siempre: la primera vez que puse estas
     direcciones de memoria, dos de tres daban 404 — y ese enlace lo pulsa una
     clienta que ya pagó. `envia.co` responde, `www.envia.co` no. */
  tcc: {
    url: 'https://www.tcc.com.co/rastrear-envio/',
    corto: 'tcc.com.co',
  },
  envia: {
    url: 'https://envia.co/rastreo',
    corto: 'envia.co',
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
