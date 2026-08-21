/**
 * Qué piezas lleva un pedido, listas para enseñar.
 *
 * Vive aparte porque lo necesitan dos correos que no se conocen entre sí: el
 * de confirmación, que sale del webhook de Mercado Pago, y el de despacho,
 * que sale del panel. Duplicarlo sería garantizar que algún día uno enseñe
 * dos piezas y el otro una.
 */
import type { createClient } from 'jsr:@supabase/supabase-js@2'

export type PiezaDePedido = {
  productId: string | null
  nombre: string
  cantidad: number
  talla: string | null
  imagen: string | null
  ficha: string | null
}

/**
 * Las piezas de un pedido, listas para enseñar.
 *
 * Sale de order_items, que es donde viven desde que un pedido puede llevar
 * más de una. Trae la foto y la ficha de cada una porque el correo las
 * enseña: una tarjeta con el nombre a secas se lee como una factura, y en
 * una joyería el producto es la mitad del mensaje.
 *
 * Si el pedido no tiene filas —los de antes de que existiera la tabla, o uno
 * al que le falló el guardado— se arma una sola pieza con lo que hay en la
 * orden. Un correo con una pieza es mejor que ningún correo.
 */
export async function piezasDelPedido(
  supabase: ReturnType<typeof createClient>,
  orderId: string,
  orden: Record<string, any>,
): Promise<PiezaDePedido[]> {
  let filas: any[] = []
  try {
    const { data } = await supabase
      .from('order_items')
      .select('product_id, nombre, cantidad, talla')
      .eq('order_id', orderId)
      .order('creado_en')
    filas = data ?? []
  } catch { /* se cae al respaldo */ }

  if (!filas.length) {
    /* Respaldo: la talla de estos pedidos vive en las notas, en texto libre,
       porque es de antes de que fuera una columna. */
    filas = [{
      product_id: orden.product_id,
      nombre: orden.product_name,
      cantidad: 1,
      talla: /Talla:\s*([^|·]+)/i.exec(String(orden.notes ?? ''))?.[1]?.trim() || null,
    }]
  }

  const ids = filas.map((f) => f.product_id).filter(Boolean)
  let catalogo: Record<string, any> = {}
  if (ids.length) {
    try {
      const { data } = await supabase
        .from('products').select('id, images, image_url, metal, piedra').in('id', ids)
      for (const p of data ?? []) catalogo[p.id] = p
    } catch { /* sin fotos, el correo sale igual */ }
  }

  return filas.map((f) => {
    const p = catalogo[f.product_id] ?? {}
    return {
      productId: f.product_id ?? null,
      nombre: String(f.nombre),
      cantidad: Number(f.cantidad) || 1,
      talla: f.talla ?? null,
      imagen: (Array.isArray(p.images) && p.images[0]) || p.image_url || null,
      ficha: [p.metal, p.piedra].filter(Boolean).join(' · ') || null,
    }
  })
}
