/**
 * Valentina. El cerebro va por OpenRouter; el catálogo y los pedidos
 * salen de la base, no del modelo, para que no invente piezas ni precios.
 */
import { admin, enviarImagen } from './wa.ts'

const MODELO = Deno.env.get('OPENROUTER_MODEL') || 'openai/gpt-5.6-luna-pro'
const MENSAJES_DE_CONTEXTO = 20

/* Topes del bucle de herramientas. Un agente sin freno es una factura sin
   freno, y Meta corta la conversación mucho antes de que valga la pena
   seguir pensando. El último paso va sin herramientas, así siempre termina
   con algo que decirle al cliente. */
const MAX_PASOS = 3
const PRESUPUESTO_MS = 25_000
/** Más de tres fotos seguidas satura el chat. */
const MAX_FOTOS = 3

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
Escribes por WhatsApp a clientes reales. Hablas en español de Colombia, con
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
7. No prometas descuentos que no estén en esta lista.
8. No des por hecho el género de quien te escribe. Habla en formas neutras
   ("¿cómo te ayudo?", "quedas atendido/a") y evita "bienvenida", "linda" o
   "reina". Si te dicen su nombre o cómo prefieren que les hablen, sigue eso.
9. TIENES FOTOS. Cuando pidan ver algo, cuando duden entre piezas o cuando
   una imagen ayude a decidir, usa mostrar_pieza. No describas una pieza
   pudiendo mostrarla. Nunca digas que no puedes mandar fotos.
10. No recites el catálogo. Ofrece una o dos piezas que encajen con lo que
   te dijeron y pregunta. La lista completa abruma y no vende.
11. Si te preguntan directamente si eres una persona o un bot, dilo: eres
   una asistente. Sonar natural es una cosa, mentir es otra.
12. TALLAS. Nunca calcules una talla de cabeza ni pidas que te la digan si
   ya te dieron una medida: usa calcular_talla. Si no saben su talla,
   guíalos así, en mensajes cortos y de a un paso:
   - Envuelve un hilo o una tira de papel en la base del dedo, ajustado
     pero sin apretar.
   - Marca donde se cruza y mídelo con una regla, en milímetros.
   - Mándame ese número.
   Detalles que sí sabes: mejor medir al final del día, porque en la mañana
   y con frío el dedo está más delgado. La talla es igual en oro, plata y
   platino, pero en bandas anchas conviene media talla más. Si es un regalo,
   que midan por dentro un anillo que esa persona ya use en ese dedo: eso es
   diámetro, no circunferencia. La guía completa está en
   auremgsjoyeria.com/guia-de-tallas
13. Si un anillo no le queda, no prometas que se puede ajustar: no todos los
   diseños admiten ajuste sin dañar el acabado. Pide la foto de la pieza y
   la medida, y escala.

CÓMO ESCRIBIR
Frases cortas. Sin punto y coma, sin dos puntos para enumerar, sin listas
con viñetas. Como se escribe por WhatsApp, no como se redacta un correo.

Emojis: de vez en cuando, no en cada mensaje. Uno cada tres o cuatro, y
sólo cuando acompaña algo — al saludar, al celebrar que le gustó una pieza,
al despedirte. Nunca dos juntos, nunca en un mensaje de precio, dirección o
plazo de envío: ahí restan seriedad. Si dudas, no lo pongas.

Si tienes que decir dos cosas, sepáralas con una línea en blanco: se envían
como dos mensajes seguidos, que es como escribe una persona. Máximo tres.

Así NO:
  "Claro. Tenemos tres opciones en plata 925: Camino Verde por $550.000,
  Majestuosa por $500.000 y Trinidad por $500.000; también está Esencia
  Imperial en oro blanco de 18K por $4.500.000. ¿Cuál te gustaría conocer?"

Así SÍ:
  "Claro, ¿buscas algo en plata o en oro?

  Te muestro para que veas."
(y llamas a mostrar_pieza)`
}

const HERRAMIENTAS = [
  {
    type: 'function',
    function: {
      name: 'mostrar_pieza',
      description: 'Envía por WhatsApp la foto de una o varias piezas del catálogo. Úsala cuando pidan ver algo, cuando duden entre opciones, o cuando una foto ayude a decidir. Las fotos llegan solas: después de llamarla, el cliente YA las tiene.',
      parameters: {
        type: 'object',
        properties: {
          piezas: {
            type: 'array',
            items: { type: 'string' },
            description: 'Nombres exactos como aparecen en el catálogo. Máximo tres.',
          },
        },
        required: ['piezas'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calcular_talla',
      description: 'Convierte una medida del dedo en talla de anillo, con la tabla oficial de Aurem Gs. Úsala SIEMPRE que te den una medida en milímetros o centímetros: nunca calcules la talla de cabeza.',
      parameters: {
        type: 'object',
        properties: {
          medida: { type: 'number', description: 'El número que dijo el cliente' },
          unidad: {
            type: 'string',
            enum: ['circunferencia_mm', 'circunferencia_cm', 'diametro_mm', 'diametro_cm'],
            description: 'Si midió con un hilo alrededor del dedo es circunferencia. Si midió un anillo por dentro, de lado a lado, es diámetro. Si no está claro, pregunta antes.',
          },
        },
        required: ['medida', 'unidad'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crear_pedido',
      description: 'Registra el pedido cuando ya tienes todos los datos confirmados por el cliente.',
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

/**
 * El historial lleva mensajes de asistente con tool_calls y respuestas de
 * herramienta, así que no encaja en `Mensaje`: por eso va suelto.
 */
async function llamarModelo(mensajes: any[], herramientas = HERRAMIENTAS) {
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
    body: JSON.stringify({
      model: MODELO,
      messages: mensajes,
      // Se omite el campo si no hay herramientas: varios proveedores
      // rechazan `tools: []` en vez de tratarlo como "ninguna".
      ...(herramientas?.length ? { tools: herramientas } : {}),
      temperature: 0.3,
      max_tokens: 600,
    }),
  })

  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`)
  return (await res.json())?.choices?.[0]?.message
}

/* Tallas de anillo. Es la MISMA tabla que la calculadora de
   /guia-de-tallas (src/pages/RingSizeGuide.jsx): circunferencia interior en
   milímetros. Si se cambia allá, hay que cambiarla acá.

   No va en el prompt a propósito. Los modelos calculan mal, y acá una
   equivocación se convierte en un anillo que no entra y una devolución. */
const TALLAS: Array<[string, number]> = [
  ['3', 44.2], ['3.5', 45.5], ['4', 46.8], ['4.5', 48.0], ['5', 49.3],
  ['5.5', 50.6], ['6', 51.9], ['6.5', 53.1], ['7', 54.4], ['7.5', 55.7],
  ['8', 57.0], ['8.5', 58.3], ['9', 59.5], ['9.5', 60.8], ['10', 62.1],
  ['10.5', 63.4], ['11', 64.6], ['11.5', 65.9], ['12', 67.2], ['12.5', 68.5],
]

/** Pasa cualquier medida a circunferencia en milímetros. */
const A_CIRCUNFERENCIA: Record<string, (v: number) => number> = {
  circunferencia_mm: (v) => v,
  circunferencia_cm: (v) => v * 10,
  diametro_mm: (v) => v * Math.PI,
  diametro_cm: (v) => v * 10 * Math.PI,
}

const unDecimal = (n: number) => n.toFixed(1).replace('.', ',')

const CAMPOS_PIEZA = 'id, name, price, image_url, images, stock'

/**
 * Encuentra una pieza por como la nombró el modelo.
 *
 * En el catálogo se llaman "Anillo Camino Verde", pero al conversar el
 * modelo dice "Camino Verde" — es lo natural, y con una búsqueda exacta no
 * encontraba nada. Se intenta exacto y luego por contenido.
 *
 * Si hay más de una coincidencia se devuelve null a propósito: mandar el
 * anillo equivocado es peor que decir que no se encontró.
 */
async function buscarPieza(nombre: string) {
  const limpio = String(nombre || '').trim()
  if (!limpio) return null
  const db = admin()

  const { data: exacta } = await db.from('products')
    .select(CAMPOS_PIEZA).eq('name', limpio).maybeSingle()
  if (exacta) return exacta

  // Los comodines de ilike se neutralizan para que no ensanchen la búsqueda.
  const patron = limpio.replace(/[%_]/g, '')
  if (!patron) return null

  const { data: parecidas } = await db.from('products')
    .select(CAMPOS_PIEZA).ilike('name', `%${patron}%`).limit(2)

  return parecidas?.length === 1 ? parecidas[0] : null
}

/**
 * Ejecuta lo que el modelo pidió y devuelve qué contarle al cliente.
 * `desdeId` es el número propio por el que va la conversación: las fotos
 * tienen que salir por el mismo número que el texto.
 */
async function ejecutarHerramienta(
  nombre: string,
  args: any,
  telefono: string,
  desdeId?: string | null,
): Promise<string> {
  const db = admin()

  if (nombre === 'mostrar_pieza') {
    const pedidas: string[] = (Array.isArray(args?.piezas) ? args.piezas : [args?.piezas])
      .filter((p: unknown) => typeof p === 'string' && p.trim())
      .slice(0, MAX_FOTOS)

    if (!pedidas.length) return 'No dijiste qué pieza mostrar. Pregúntale cuál quiere ver.'

    const enviadas: string[] = []
    const problemas: string[] = []

    for (const cual of pedidas) {
      const pieza = await buscarPieza(cual)

      if (!pieza) { problemas.push(`"${cual}" no está en el catálogo, o hay varias que se llaman parecido`); continue }
      if (pieza.stock === 0) { problemas.push(`${pieza.name} está agotada, no la ofrezcas`); continue }

      // image_url es la principal; images guarda los otros ángulos.
      const url = pieza.image_url || (Array.isArray(pieza.images) ? pieza.images[0] : null)
      if (!url) { problemas.push(`${pieza.name} no tiene foto cargada`); continue }

      const pie = `${pieza.name} — $${Number(pieza.price).toLocaleString('es-CO')} COP`
      const envio = await enviarImagen(telefono, url, pie, 'ia', desdeId)
      if (envio.ok) enviadas.push(pieza.name)
      else problemas.push(`no salió la foto de ${pieza.name}`)
    }

    const partes: string[] = []
    if (enviadas.length) {
      partes.push(
        `Fotos ya enviadas: ${enviadas.join(', ')}. El cliente YA las está viendo. ` +
        `No digas que se las vas a mandar. Comenta algo breve y pregunta cuál le gusta.`,
      )
    }
    if (problemas.length) partes.push(`No se pudo con: ${problemas.join('; ')}.`)
    return partes.join(' ') || 'No se pudo enviar ninguna foto. Descríbelas y discúlpate sin dramatizar.'
  }

  if (nombre === 'calcular_talla') {
    const medida = Number(args?.medida)
    const convertir = A_CIRCUNFERENCIA[String(args?.unidad)]
    if (!Number.isFinite(medida) || medida <= 0 || !convertir) {
      return 'Esa medida no se entiende. Pregúntale cómo midió y con qué unidad.'
    }

    const circ = convertir(medida)

    if (circ < TALLAS[0][1]) {
      return `Esa medida (${unDecimal(circ)} mm de circunferencia) queda por debajo de la talla 3. ` +
             `Dile que se la fabricamos a la medida y que le confirmas por interno.`
    }
    const mayor = TALLAS[TALLAS.length - 1]
    if (circ > mayor[1]) {
      return `Esa medida (${unDecimal(circ)} mm de circunferencia) pasa la talla ${mayor[0]}. ` +
             `Dile que se la fabricamos a la medida y que le confirmas por interno.`
    }

    /* Entre dos tallas se toma la mayor: un anillo holgado se acomoda, uno
       apretado no entra. Es la misma regla que la calculadora del sitio. */
    const fila = TALLAS.find(([, mm]) => mm >= circ)!
    const justa = Math.abs(fila[1] - circ) < 0.15

    return `La talla es ${fila[0]}. (${unDecimal(circ)} mm de circunferencia, ` +
           `${unDecimal(fila[1] / Math.PI)} mm de diámetro interior.) ` +
           (justa ? 'Cae justo en esa talla. ' : 'Quedó entre dos tallas y se toma la mayor, porque un anillo holgado se acomoda y uno apretado no entra. ') +
           `Díselo con naturalidad y sigue con el pedido. No le preguntes otra vez qué talla es: ya la sabes.`
  }

  if (nombre === 'escalar_a_humano') {
    await db.from('chat_takeover').upsert(
      { phone_number: telefono, is_active: true, admin_email: 'valentina@bot', reason: args?.motivo ?? null },
      { onConflict: 'phone_number' },
    )
    return 'Dile que en un momento alguien del equipo se comunica. No sigas preguntando.'
  }

  if (nombre === 'crear_pedido') {
    // El precio se toma del catálogo, no de lo que diga el modelo.
    const pieza = await buscarPieza(args.producto)

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
      return 'Hubo un problema al registrar el pedido. Discúlpate y dile que alguien del equipo se comunica enseguida.'
    }
    return `Pedido registrado por $${Number(pieza.price).toLocaleString('es-CO')} COP. Confírmaselo y dile los siguientes pasos según el medio de pago.`
  }

  return 'Esa herramienta no existe.'
}

/**
 * Punto de entrada: dado un teléfono, decide y devuelve la respuesta.
 *
 * Es un bucle, no una sola ronda: mostrar una foto y después comentarla son
 * dos pasos, y con una sola ronda el segundo nunca ocurría.
 */
export async function responder(
  telefono: string,
  desdeId?: string | null,
): Promise<string | null> {
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

  const mensajes: any[] = [
    { role: 'system', content: instrucciones(await catalogo()) },
    ...conversacion,
  ]

  const empezo = Date.now()

  for (let paso = 0; paso < MAX_PASOS; paso++) {
    /* El último paso va sin herramientas para forzar una respuesta de texto:
       nunca se le deja al cliente el chat en silencio. */
    const sinTiempo = Date.now() - empezo > PRESUPUESTO_MS
    const ultimo = paso === MAX_PASOS - 1 || sinTiempo

    const tModelo = Date.now()
    const respuesta = await llamarModelo(mensajes, ultimo ? [] : HERRAMIENTAS)
    const llamadas = respuesta?.tool_calls ?? []
    console.log(
      `modelo · paso ${paso + 1} · ${Date.now() - tModelo} ms · ` +
      `${llamadas.length ? llamadas.map((l: any) => l.function.name).join('+') : 'texto'}`,
    )

    if (!llamadas.length) {
      console.log(`turno resuelto en ${Date.now() - empezo} ms y ${paso + 1} paso(s)`)
      return String(respuesta?.content || '').trim() || null
    }

    mensajes.push(respuesta)

    for (const llamada of llamadas) {
      let args: any = {}
      try { args = JSON.parse(llamada.function.arguments || '{}') } catch { /* argumentos rotos */ }

      // Escalar corta el bucle: a partir de acá contesta una persona.
      if (llamada.function.name === 'escalar_a_humano') {
        await ejecutarHerramienta(llamada.function.name, args, telefono, desdeId)
        return 'Dame un momento, te comunico con alguien del equipo que te ayuda con eso. 🌿'
      }

      /* Se registra qué herramienta y cuánto tardó. Sin esto, un turno de
         86 segundos es un misterio: no se sabe si fue el modelo, la base o
         Meta, ni cuántas vueltas dio el bucle. */
      const t0 = Date.now()
      const resultado = await ejecutarHerramienta(llamada.function.name, args, telefono, desdeId)
      console.log(`herramienta ${llamada.function.name} · paso ${paso + 1} · ${Date.now() - t0} ms`)
      mensajes.push({ role: 'tool', tool_call_id: llamada.id, content: resultado })
    }
  }

  console.error(`Se agotaron los ${MAX_PASOS} pasos sin respuesta, tras ${Date.now() - empezo} ms`)
  return null
}
