/**
 * Valentina. El cerebro va por OpenRouter; el catálogo y los pedidos
 * salen de la base, no del modelo, para que no invente piezas ni precios.
 */
import { admin } from './wa.ts'

const MODELO = Deno.env.get('OPENROUTER_MODEL') || 'anthropic/claude-3.5-sonnet'
const MENSAJES_DE_CONTEXTO = 20

type Mensaje = { role: 'user' | 'assistant' | 'system'; content: string }

/** El catálogo real, tal cual está publicado ahora mismo. */
async function catalogo(): Promise<string> {
  const { data } = await admin()
    .from('products')
    .select('name, category, price, description, stock')
    .order('created_at', { ascending: false })

  if (!data?.length) return 'No hay piezas publicadas ahora mismo.'

  return data.map((p) => {
    const agotado = p.stock === 0 ? ' — AGOTADA, no la ofrezcas' : ''
    return `- ${p.name} (${p.category}): $${Number(p.price).toLocaleString('es-CO')} COP${agotado}` +
           (p.description ? `\n  ${String(p.description).slice(0, 180)}` : '')
  }).join('\n')
}

function instrucciones(piezas: string): string {
  return `Eres Valentina, la asesora de Aurem Gs Joyería, una joyería colombiana.
Escribes por WhatsApp a clientas reales. Hablas en español de Colombia, con
cercanía y sin adular. Mensajes cortos: dos o tres frases, salvo que estés
recapitulando un pedido.

CATÁLOGO PUBLICADO (es el único que existe):
${piezas}

REGLAS QUE NO SE ROMPEN
1. Nunca inventes una pieza, un precio, un material, un quilataje ni un plazo.
   Si no está arriba, no existe: dilo y ofrece lo que sí hay.
2. Si no entiendes algo, NO respondas "no te entendí". Repite lo que creas
   haber entendido y pregunta por lo que falta. Ejemplo: si dice "pago de una
   vez", eso significa que quiere pagar ya — confírmale el medio de pago.
3. Medios de pago: Mercado Pago (2% de descuento) o contra entrega. Envíos a
   todo el país en 24 a 48 horas hábiles.
4. Para cerrar un pedido necesitas: pieza, talla si es anillo, nombre completo,
   dirección y ciudad. Pídelos de a poco, no todos de golpe.
5. Cuando los tengas todos, recapitula y usa la herramienta crear_pedido.
6. Si te piden algo que no puedes resolver —un reclamo, un cambio, un precio
   especial, hablar con una persona— usa escalar_a_humano y dilo con calma.
7. No prometas descuentos que no estén en esta lista.`
}

const HERRAMIENTAS = [
  {
    type: 'function',
    function: {
      name: 'crear_pedido',
      description: 'Registra el pedido cuando ya tienes todos los datos confirmados por la clienta.',
      parameters: {
        type: 'object',
        properties: {
          producto: { type: 'string', description: 'Nombre exacto de la pieza, tal como aparece en el catálogo' },
          monto: { type: 'number', description: 'Precio en COP, el del catálogo' },
          nombre: { type: 'string' },
          direccion: { type: 'string' },
          ciudad: { type: 'string' },
          talla: { type: 'string', description: 'Sólo si es anillo' },
          metodo_pago: { type: 'string', enum: ['Mercado Pago', 'Contra entrega'] },
        },
        required: ['producto', 'monto', 'nombre', 'direccion', 'ciudad', 'metodo_pago'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'escalar_a_humano',
      description: 'Pasa la conversación a una persona del equipo y deja de responder.',
      parameters: {
        type: 'object',
        properties: { motivo: { type: 'string' } },
        required: ['motivo'],
      },
    },
  },
]

async function llamarModelo(mensajes: Mensaje[], herramientas = HERRAMIENTAS) {
  const clave = Deno.env.get('OPENROUTER_API_KEY')
  if (!clave) throw new Error('Falta OPENROUTER_API_KEY')

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${clave}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://www.auremgsjoyeria.com',
      'X-Title': 'Aurem Gs · Valentina',
    },
    body: JSON.stringify({ model: MODELO, messages: mensajes, tools: herramientas, temperature: 0.3, max_tokens: 600 }),
  })

  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`)
  return (await res.json())?.choices?.[0]?.message
}

/** Ejecuta lo que el modelo pidió y devuelve qué contarle a la clienta. */
async function ejecutarHerramienta(nombre: string, args: any, telefono: string): Promise<string> {
  const db = admin()

  if (nombre === 'escalar_a_humano') {
    await db.from('chat_takeover').upsert(
      { phone_number: telefono, is_active: true, admin_email: 'valentina@bot', reason: args?.motivo ?? null },
      { onConflict: 'phone_number' },
    )
    return 'Dile que en un momento la atiende alguien del equipo. No sigas preguntando.'
  }

  if (nombre === 'crear_pedido') {
    // El precio se toma del catálogo, no de lo que diga el modelo.
    const { data: pieza } = await db.from('products')
      .select('id, name, price').eq('name', args.producto).maybeSingle()

    if (!pieza) return `Esa pieza no está en el catálogo. Dile que revisas y ofrécele las que sí hay.`

    const notas = [args.talla ? `Talla: ${args.talla}` : null, 'Pedido tomado por Valentina']
      .filter(Boolean).join(' · ')

    const { error } = await db.from('orders').insert({
      customer_name: args.nombre,
      customer_phone: telefono,
      product_id: pieza.id,
      product_name: pieza.name,
      amount: pieza.price,
      status: 'pendiente',
      payment_method: args.metodo_pago,
      order_source: 'whatsapp',
      shipping_address: args.direccion,
      shipping_city: args.ciudad,
      notes: notas,
    })

    if (error) {
      console.error('No se pudo crear el pedido:', error.message)
      return 'Hubo un problema al registrar el pedido. Discúlpate y dile que alguien la contacta enseguida.'
    }
    return `Pedido registrado por $${Number(pieza.price).toLocaleString('es-CO')} COP. Confírmaselo y dile los siguientes pasos según el medio de pago.`
  }

  return 'Esa herramienta no existe.'
}

/** Punto de entrada: dado un teléfono, decide y devuelve la respuesta. */
export async function responder(telefono: string): Promise<string | null> {
  const db = admin()

  const { data: historial } = await db
    .from('whatsapp_conversaciones')
    .select('role, content')
    .eq('phone_number', telefono)
    .order('created_at', { ascending: false })
    .limit(MENSAJES_DE_CONTEXTO)

  const conversacion: Mensaje[] = (historial ?? []).reverse()
    .filter((m) => m.content)
    .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))

  const mensajes: Mensaje[] = [
    { role: 'system', content: instrucciones(await catalogo()) },
    ...conversacion,
  ]

  let respuesta = await llamarModelo(mensajes)

  // Una sola ronda de herramientas: suficiente para cerrar o escalar.
  const llamada = respuesta?.tool_calls?.[0]
  if (llamada) {
    let args: any = {}
    try { args = JSON.parse(llamada.function.arguments || '{}') } catch { /* argumentos rotos */ }
    const resultado = await ejecutarHerramienta(llamada.function.name, args, telefono)

    if (llamada.function.name === 'escalar_a_humano') {
      return 'Dame un momento, te comunico con alguien del equipo que te ayuda con eso. 🌿'
    }

    respuesta = await llamarModelo([
      ...mensajes,
      { role: 'system', content: `Resultado de ${llamada.function.name}: ${resultado}` },
    ], [])
  }

  const texto = String(respuesta?.content || '').trim()
  return texto || null
}
