/**
 * La confirmación por correo de un pedido.
 *
 * Vive aparte porque lo necesitan dos sitios que no se conocen entre sí:
 * `mp-webhook`, cuando entra un pago, y `create-preference`, cuando un
 * contraentrega de Bogotá nace confirmado sin pagar nada. Duplicarlo sería
 * garantizar que algún día uno enseñe una cosa y el otro otra.
 *
 * El segundo caso apareció el 1 de septiembre de 2026, al quitar el abono: la
 * clienta se comprometía a pagar en su puerta y **no recibía ninguna
 * constancia**, porque el único que mandaba el correo era el webhook del pago
 * y ya no hay pago que esperar.
 */
import type { PiezaDePedido } from './pedidos.ts'

/**
 * Le pide a la función de Vercel que mande la confirmación por correo.
 *
 * Trae la foto y la ficha de la pieza porque el correo las enseña: una
 * tarjeta con el nombre a secas se lee como una factura, y en una joyería el
 * producto es la mitad del mensaje. Si la consulta falla, el correo sale
 * igual con el rombo de la marca en vez de la foto — mejor eso que no
 * mandarlo.
 */
export async function avisarPorCorreo(
  orden: Record<string, any>,
  orderId: string,
  esAbono: boolean,
  piezas: PiezaDePedido[],
) {
  const base = Deno.env.get('APP_URL') ?? 'https://www.auremgsjoyeria.com'
  const secreto = Deno.env.get('CORREO_SECRETO')
  if (!secreto) {
    console.error('correo: falta CORREO_SECRETO, no se manda')
    return
  }

  /* La referencia que ve la clienta es la misma que enseña la ficha de la
     pieza en el sitio. Si acá saliera otra, un reclamo por correo y otro por
     WhatsApp parecerían dos pedidos distintos. */
  const referencia = `AG-${String(orden.product_id).replace(/\D/g, '').slice(-4).padStart(4, '0')}`

  const fecha = new Date().toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota',
  })

  const res = await fetch(`${base}/api/correo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-correo-secreto': secreto },
    body: JSON.stringify({
      plantilla: 'pedido-confirmado',
      para: orden.customer_email,
      /* La referencia del pedido y no la de la pieza: es lo que hace que un
         reenvío del webhook no mande el correo dos veces. */
      referencia: orderId,
      datos: {
        nombre: orden.customer_name,
        pieza: orden.product_name,
        referencia,
        total: Number(orden.amount),
        abono: esAbono ? Number(orden.abono_monto) : null,
        /* Sin esto, un contraentrega sin abono recibía el correo de «pago
           recibido»: le decía a la clienta que había pagado cuando no ha
           pagado un peso, y eso es peor que no mandar nada. */
        contraentrega: orden.payment_method === 'contraentrega',
        ciudad: orden.shipping_city ?? 'Colombia',
        direccion: orden.shipping_address ?? '',
        piezas,
        fecha,
      },
    }),
  })

  if (!res.ok) {
    throw new Error(`api/correo respondió ${res.status}: ${(await res.text()).slice(0, 160)}`)
  }
  console.log('Confirmación por correo enviada:', orderId)
}
