/**
 * Valentina. El cerebro va por OpenRouter; el catálogo, las políticas, los
 * precios y los pedidos salen de la base, no del modelo, para que no
 * invente nada.
 */
import { admin, enviarImagen, enviarTexto } from './wa.ts'

const MODELO = Deno.env.get('OPENROUTER_MODEL') || 'openai/gpt-5.6-luna-pro'
const MENSAJES_DE_CONTEXTO = 20

/* Topes del bucle de herramientas. Un agente sin freno es una factura sin
   freno. El último paso va sin herramientas, así siempre termina con algo
   que decirle al cliente. */
const MAX_PASOS = 3
const PRESUPUESTO_MS = 25_000
/** Más de tres fotos seguidas satura el chat. */
const MAX_FOTOS = 3

/* Cada cuánto hay que mirar el precio del oro. El joyero lo consulta a
   diario, pero NO cambia la cotización por movimientos chicos: "si mañana
   baja 5000 o sube 3000 no importa". Así que el dato guardado se usa tal
   cual; lo único que se vigila es que no esté abandonado. */
const DIAS_PARA_AVISAR = 3
const DIAS_PARA_NO_COTIZAR = 10

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

/**
 * Lo que el negocio sabe de sí mismo: envíos, pagos, garantía, proceso.
 *
 * Vive en la base y no en este archivo. Estaba escrito acá y se
 * desincronizó: llegó a prometer "Mercado Pago con 2% de descuento, envíos
 * en 24 a 48 horas" cuando el taller cobra por Nequi y despacha por
 * Interrapidísimo. Cambiar una política no puede exigir un despliegue.
 */
async function conocimiento(): Promise<string> {
  const { data } = await admin()
    .from('taller_conocimiento')
    .select('tema, contenido')
    .eq('activo', true)
    .order('orden')

  if (!data?.length) return 'No hay políticas cargadas: no afirmes nada sobre envíos, pagos ni garantía. Escala.'
  return data.map((t) => `${t.tema}: ${t.contenido}`).join('\n')
}

/**
 * Las dos cifras del contraentrega: hasta cuánto se despacha así, y cuánto
 * se abona para confirmarlo.
 *
 * Salen de taller_precios, que es de donde las lee create-preference al
 * cobrar. Podrían escribirse en taller_conocimiento y ahorrarse la consulta,
 * pero entonces vivirían en dos sitios y algún día dirían cosas distintas.
 *
 * El abono está acá porque Valentina lo inventó en la primera prueba real:
 * le dijo a un cliente que eran "unos $15.000" y cincuenta segundos después
 * le mandó un enlace de $20.000. No tenía el dato, así que lo adivinó — y un
 * modelo al que le falta un número no calla, rellena. La única defensa es
 * dárselo.
 *
 * Si falla, van null y las instrucciones le dicen que no ofrezca
 * contraentrega. Perder uno es una molestia; prometer una cifra equivocada
 * sobre plata ajena es otra cosa.
 */
async function cifrasContraentrega(): Promise<{ tope: number | null; abono: number | null }> {
  const { data } = await admin()
    .from('taller_precios').select('tope_contraentrega, abono_envio').maybeSingle()

  const valido = (v: unknown) => {
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  return { tope: valido(data?.tope_contraentrega), abono: valido(data?.abono_envio) }
}

/**
 * El anuncio del que vino esta conversación, si vino de uno.
 *
 * Meta manda el referral sólo en el primer mensaje, así que se busca el más
 * antiguo de la conversación. Los campos se leen a la defensiva: el esquema
 * no está documentado en abierto y puede traer más de lo que se espera; lo
 * que no se use igual queda guardado entero en la fila.
 */
async function referralDe(telefono: string): Promise<any | null> {
  const { data } = await admin()
    .from('whatsapp_conversaciones')
    .select('referral')
    .eq('phone_number', telefono)
    .not('referral', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  return data?.referral ?? null
}

/** Cómo contárselo al modelo, para que abra reconociendo lo que vio. */
function origen(r: any | null): string {
  if (!r) return ''

  const titular = r.headline || r.body || null
  const tipo = r.source_type === 'post' ? 'una publicación' : 'un anuncio'

  return titular
    ? `Esta persona llegó desde ${tipo} que decía: "${String(titular).slice(0, 160)}".`
    : `Esta persona llegó desde ${tipo}.`
}

/** Cómo anotarlo en el pedido, para poder medir qué creativo vende. */
function anuncioDe(r: any | null): string | null {
  if (!r) return null
  const id = r.source_id || r.ctwa_clid || null
  return id ? `Anuncio: ${id}` : 'Llegó por anuncio'
}

/**
 * Los identificadores del anuncio, para guardarlos como datos y no como
 * texto en una nota.
 *
 * El `ctwa_clid` es el que importa de verdad: es lo que hay que devolverle a
 * Meta cuando la venta se cierra para que se la atribuya al anuncio que la
 * trajo. Sin él, Valentina vende y el anuncio nunca se entera.
 */
function atribucionDe(r: any | null): { ctwa_clid: string | null; anuncio_id: string | null } {
  if (!r) return { ctwa_clid: null, anuncio_id: null }
  return {
    ctwa_clid: r.ctwa_clid ?? null,
    anuncio_id: r.source_id ?? null,
  }
}

/**
 * La marca `[ref: tiktok]` que el sitio le pega al primer mensaje.
 *
 * Existe porque TikTok, a diferencia de Meta, no manda ningún identificador
 * cuando su anuncio abre WhatsApp. Sin esto, todas esas conversaciones
 * parecerían tráfico directo y las campañas de TikTok se verían como si no
 * vendieran nada.
 *
 * Se busca en el primer mensaje de la persona, que es donde el enlace la
 * pone. Un mensaje posterior que traiga la marca es de una visita nueva y no
 * debería reescribir de dónde vino originalmente.
 */
async function refDeMensajes(telefono: string): Promise<string | null> {
  const { data } = await admin()
    .from('whatsapp_conversaciones')
    .select('content')
    .eq('phone_number', telefono)
    .eq('role', 'user')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const marca = String(data?.content ?? '').match(/\[ref:\s*([a-z0-9_-]{1,20})\]/i)
  return marca ? marca[1].toLowerCase() : null
}

function instrucciones(piezas: string, politicas: string, deDonde: string, cod: { tope: number | null; abono: number | null }): string {
  return `Eres Valentina, la asesora de Aurem Gs Joyería, una joyería colombiana.
Escribes por WhatsApp a clientes reales. Hablas en español de Colombia, con
cercanía y sin adular. Mensajes cortos: dos o tres frases, salvo que estés
recapitulando un pedido.

CATÁLOGO PUBLICADO (es el único que existe):
${piezas}

CÓMO FUNCIONA EL NEGOCIO (es lo único que puedes afirmar sin consultar):
${politicas}
${deDonde ? `\nDE DÓNDE VIENE\n${deDonde}\nAbre reconociendo eso, con naturalidad — "vi que te interesó…" — y sigue por ahí.\nNO recites el anuncio ni repitas su texto: sólo demuestra que sabes qué vio.\nSi el anuncio prometía algo que no está en las políticas de arriba, NO lo\nconfirmes: dilo con calma y escala.\n` : ''}

REGLAS QUE NO SE ROMPEN
1. Nunca inventes una pieza, un precio, un material, un quilataje ni un plazo.
   Si no está arriba, no existe: dilo y ofrece lo que sí hay.
2. Si no entiendes algo, NO respondas "no te entendí". Repite lo que creas
   haber entendido y pregunta por lo que falta. Ejemplo: si dice "pago de una
   vez", eso significa que quiere pagar ya — confírmale el medio de pago.
3. Sobre envíos, pagos, garantía y plazos di SÓLO lo que está arriba, tal
   como está. Si te preguntan algo que no aparece ahí, no lo deduzcas ni lo
   inventes: dilo con naturalidad y usa escalar_a_humano.
4. Para cerrar un pedido necesitas: pieza, talla si es anillo, nombre completo,
   dirección, ciudad y correo. Pídelos de a poco, no todos de golpe.
5. EL CORREO. Pídelo siempre y di para qué es: ahí le llega el comprobante
   del pago y la confirmación del pedido con el detalle de la pieza. Si no lo
   da, o escribe algo que no parece un correo, insiste UNA sola vez.
   Si sigue sin darlo, déjalo ahí: cierra el pedido sin correo y dile que
   entonces le llega todo por WhatsApp. NUNCA dejes un pedido sin cerrar por
   un correo — vale mucho más la venta que el dato.
6. Cuando tengas todo, recapitula y usa la herramienta crear_pedido.
6b. EL CONTRAENTREGA: ${cod.tope ? `hasta ${enPesos(cod.tope)}` : 'no lo ofrezcas, no tengo el tope a mano'}${cod.abono ? `, con un abono de ${enPesos(cod.abono)} que confirma el pedido y se descuenta del total` : ''}.
   ESE ABONO ES ${cod.abono ? enPesos(cod.abono) : 'UN DATO QUE NO TIENES'} — no lo redondees, no digas "unos", no digas
   "aproximadamente" y NUNCA des otra cifra. Si no lo tienes, di que lo
   confirmas y no inventes un número.
   Y el tope no tiene excepción. Por encima de eso la pieza se paga en
   línea, porque si la rechazan en la puerta el taller pierde el viaje de ida y vuelta de una
   joya cara. No lo ofrezcas para una pieza que pase el tope, ni lo prometas
   "consultando". Si te lo piden, dilo derecho y sin disculparte de más: en
   piezas de ese valor el pago va por adelantado, y de ahí en más el envío
   corre por cuenta nuestra y llega asegurado. La herramienta también lo
   rechaza, así que ofrecerlo sólo consigue que quedes mal.
7. Si te piden algo que no puedes resolver —un reclamo, un cambio, un precio
   especial, hablar con una persona— usa escalar_a_humano y dilo con calma.
8. No prometas descuentos que no estén en esta lista.
9. EL NOMBRE, TEMPRANO. En el primer o segundo mensaje pregúntalo con
   naturalidad — "¿con quién tengo el gusto?" — y a partir de ahí úsalo.
   Llamar a alguien por su nombre da más cercanía que cualquier fórmula.
   Pero NO deduzcas el género del nombre ni de lo que compra. Mucha gente
   compra joyería de regalo, y arrancar con "bienvenida, linda" cuando es un
   señor comprándole a su esposa arruina el primer mensaje. Habla en formas
   neutras ("¿cómo te ayudo?", "quedas atendido/a") y evita "bienvenida",
   "linda" o "reina". Si la persona dice cómo quiere que le hablen, o se
   nombra a sí misma en femenino o masculino, síguelo: ahí ya no adivinas.
10. TIENES FOTOS. Cuando pidan ver algo, cuando duden entre piezas o cuando
   una imagen ayude a decidir, usa mostrar_pieza. No describas una pieza
   pudiendo mostrarla. Nunca digas que no puedes mandar fotos.
11. No recites el catálogo. Ofrece una o dos piezas que encajen con lo que
   te dijeron y pregunta. La lista completa abruma y no vende.
12. Si te preguntan directamente si eres una persona o un bot, dilo: eres
   una asistente. Sonar natural es una cosa, mentir es otra.
13. TALLAS. Nunca calcules una talla de cabeza ni pidas que te la digan si
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
14. Si un anillo no le queda, no prometas que se puede ajustar: no todos los
   diseños admiten ajuste sin dañar el acabado. Pide la foto de la pieza y
   la medida, y escala.
15. CUANDO TE MANDAN UNA FOTO, ya la viste: en el hilo aparece con 📷 y la
   descripción de lo que muestra. Habla de esa foto con naturalidad, no
   preguntes qué mandaron ni digas que no puedes verla.

PIEZAS A MEDIDA
Buena parte del negocio es fabricar lo que el cliente pide, no vender del
catálogo. Se puede hacer cualquier diseño, incluso a partir de una foto.

16. En ORO puedes dar el precio tú, con cotizar_oro, si sabes el gramaje.
   Si no lo sabes, pregunta qué diseño y qué tan gruesa la quiere, o escala.
17. En PLATA NO cotizas nunca. La plata se vende por pieza, no por gramo, y
   ese precio lo pone una persona. Escala.
18. Las PIEDRAS suman aparte y no sabes cuánto: depende de la piedra. Si la
   pieza lleva esmeraldas o diamantes, dilo con naturalidad y escala.
19. Piezas livianas tampoco se cotizan por gramo. La herramienta te avisa.
20. Cómo se trabaja una pieza a medida está arriba, en cómo funciona el
   negocio. Cuéntalo cuando ayude a dar confianza: alguien que va a girar
   plata por algo que todavía no existe necesita saber el recorrido.

21. Si te dicen su presupuesto —"algo de unos 100 mil"— trabaja hacia ese
   número: muéstrale lo que sí alcanza en vez de recitar precios más altos.
22. Ante una objeción de precio NO descuentes por reflejo. Sube el valor:
   que es una pieza única, hecha desde cero, que se puede personalizar con
   iniciales o una fecha sin costo extra. Bajar el precio es decisión de una
   persona, no tuya.

23. Si el primer mensaje trae algo entre corchetes como [ref: tiktok], es una
   marca del sitio para saber de dónde vino la persona. No la menciones, no
   la comentes y no preguntes qué significa. Responde como si no estuviera.

CÓMO ESCRIBIR
Frases cortas. Sin punto y coma, sin dos puntos para enumerar, sin listas
con viñetas. Como se escribe por WhatsApp, no como se redacta un correo.

La gente escribe rápido y con errores: "B noche", "Nesecito", "cuando me
costaría", "Ola pa". Se entiende y se sigue, no se corrige ni se comenta.

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
      name: 'cotizar_oro',
      description: 'Calcula el precio de una pieza a medida EN ORO, cuando ya se sabe cuántos gramos lleva. Sólo sirve para oro y para piezas de cierto peso para arriba. NO sirve para plata, que se vende por pieza, ni para calcular lo que suman las piedras.',
      parameters: {
        type: 'object',
        properties: {
          gramos: { type: 'number', description: 'Peso aproximado de la pieza en gramos' },
          descripcion: { type: 'string', description: 'Qué pieza es, en pocas palabras' },
        },
        required: ['gramos'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crear_pedido',
      description: 'Registra el pedido cuando ya tienes todos los datos confirmados por el cliente. Si el medio de pago es Mercado Pago, además genera el enlace de pago y se lo envía: no hace falta que hagas nada más con eso.',
      parameters: {
        type: 'object',
        properties: {
          producto: { type: 'string', description: 'Nombre exacto de la pieza, tal como aparece en el catálogo' },
          monto: { type: 'number', description: 'Precio en COP, el del catálogo' },
          nombre: { type: 'string' },
          direccion: { type: 'string' },
          ciudad: { type: 'string' },
          /* Opcional a propósito, aunque a Valentina se le pide que insista.
             Si fuera obligatorio acá, el modelo no podría cerrar un pedido de
             quien no quiere dar su correo y se quedaría pidiéndolo en bucle
             hasta que la persona se aburre. La insistencia va en las
             instrucciones, que sí saben cuándo parar; el esquema sólo define
             qué es posible. */
          correo: { type: 'string', description: 'Correo del cliente. Se le pide, pero si no lo da el pedido se crea igual.' },
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
      description: 'Pasa la conversación a una persona del equipo y deja de responder. Úsala también para cotizar plata, piezas con piedras, o cualquier cosa a medida que no puedas calcular.',
      parameters: {
        type: 'object',
        properties: {
          motivo: { type: 'string', description: 'Para el equipo, no para el cliente: qué pidió y por qué no lo pudiste resolver.' },
          /* Lo que de verdad lee el cliente. Antes salía siempre la misma
             frase suelta, sin importar de qué venían hablando: alguien
             mandaba una foto de su anillo y lo único que recibía era "te
             comunico con alguien del equipo". Se lee como una puerta que se
             cierra, justo cuando acaba de enseñar lo que quiere. */
          mensaje: {
            type: 'string',
            description: 'Lo que se le dice al cliente, en tu voz. Reconoce primero lo que pidió —si mandó una foto, di qué viste en ella— y después que lo pasas con alguien del equipo. Dos frases cortas.',
          },
        },
        required: ['motivo', 'mensaje'],
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
const enPesos = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`

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

      const pie = `${pieza.name} — ${enPesos(Number(pieza.price))} COP`
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

  if (nombre === 'cotizar_oro') {
    const gramos = Number(args?.gramos)
    if (!Number.isFinite(gramos) || gramos <= 0) {
      return 'No dijo cuántos gramos. Pregúntale por el diseño y el tamaño, o escala para que el taller lo calcule.'
    }

    const { data: precios } = await db.from('taller_precios')
      .select('precio_gramo_oro, recargo_por_gramo, gramos_minimos, actualizado_en')
      .maybeSingle()

    if (!precios) {
      console.error('No hay fila en taller_precios')
      return 'No tengo la lista de precios a mano. Usa escalar_a_humano.'
    }

    /* En piezas livianas la merma se come la ganancia, así que no se cotiza
       por gramo: va por pieza, y ese número lo pone una persona. */
    if (gramos < Number(precios.gramos_minimos)) {
      return `Son ${gramos} gramos, menos del mínimo de ${precios.gramos_minimos} para cotizar por gramo. ` +
             `Una pieza así se cobra por pieza, no por peso. Dile que lo consultas con el taller y usa escalar_a_humano.`
    }

    const dias = (Date.now() - new Date(precios.actualizado_en).getTime()) / 86_400_000

    if (dias > DIAS_PARA_NO_COTIZAR) {
      console.error(`Precio del oro con ${Math.round(dias)} días sin actualizar: no se cotiza`)
      return 'El precio del oro que tengo está viejo y no quiero darte un número equivocado. Usa escalar_a_humano.'
    }

    const porGramo = Number(precios.precio_gramo_oro) + Number(precios.recargo_por_gramo)
    const total = porGramo * gramos

    const aviso = dias > DIAS_PARA_AVISAR
      ? ` (Ojo: el precio base lleva ${Math.round(dias)} días sin actualizarse.)`
      : ''

    return `Son ${enPesos(total)} por ${gramos} gramos de oro — ${enPesos(porGramo)} el gramo.${aviso} ` +
           `Ese precio ya incluye diseño, fundición y terminado. ` +
           `Si la pieza lleva esmeraldas o diamantes eso suma aparte y NO lo sabes calcular: dilo y escala. ` +
           `Dale el número redondeado y con naturalidad, sin desglosar el recargo.`
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

    const contraEntrega = String(args.metodo_pago || '').toLowerCase().includes('entrega')

    /* Se delega en create-preference en vez de insertar acá. Esa función ya
       cancela pedidos pendientes duplicados, guarda la preferencia de Mercado
       Pago y arma el enlace; duplicar eso era tener dos verdades sobre cómo
       nace un pedido, y la de acá ya se estaba quedando corta. */
    const url = Deno.env.get('SUPABASE_URL')
    const clave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !clave) {
      console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
      return 'No se pudo registrar el pedido. Usa escalar_a_humano.'
    }

    const referral = await referralDe(telefono)
    const anuncio = anuncioDe(referral)

    let respuesta: any = {}
    try {
      const res = await fetch(`${url}/functions/v1/create-preference`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${clave}`,
          apikey: clave,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [{ id: pieza.id, name: pieza.name, price: Number(pieza.price) }],
          buyer: {
            name: args.nombre,
            phone: telefono,
            /* Sin correo el pedido sigue: create-preference sólo exige uno de
               los dos, y por WhatsApp el teléfono siempre está. Lo que se
               pierde es el comprobante de Mercado Pago, no la venta. */
            email: args.correo || null,
            address: args.direccion,
            city: args.ciudad,
          },
          paymentMethod: contraEntrega ? 'cod' : 'mp',
          /* Los identificadores del anuncio van como datos aparte de la nota:
             la nota es para leerla, esto es para devolvérselo a Meta cuando
             se cobre y para poder contar ventas por origen. */
          atribucion: { ...atribucionDe(referral), utm_source: await refDeMensajes(telefono) },
          notes: [
            args.talla ? `Talla: ${args.talla}` : null,
            'Pedido tomado por Valentina',
            // Legible en el panel; el dato que se mide va en `atribucion`.
            anuncio,
          ].filter(Boolean).join(' · '),
        }),
      })
      respuesta = await res.json().catch(() => ({}))

      /* El tope del contraentrega, rechazado por el servidor. No es un fallo
         técnico y no se debe tratar como tal: es una regla del negocio, y
         Valentina tiene que poder seguir la conversación ofreciendo el pago
         en línea en vez de mandar el pedido a una persona. */
      if (res.status === 422 && respuesta?.error === 'contraentrega_no_disponible') {
        const tope = enPesos(Number(respuesta.tope ?? 0))
        return `Esta pieza pasa el tope del contraentrega (${tope}), así que no se puede ` +
               `despachar así. NO escales: explícale con naturalidad que en piezas de este ` +
               `valor el pago va en línea, que por eso el envío va asegurado y por cuenta ` +
               `nuestra, y ofrécele el enlace de Mercado Pago. Si acepta, vuelve a llamar ` +
               `crear_pedido con metodo_pago "Mercado Pago".`
      }

      if (!res.ok) throw new Error(respuesta?.error || `HTTP ${res.status}`)
    } catch (e) {
      console.error('create-preference falló:', e instanceof Error ? e.message : e)
      return 'Hubo un problema al registrar el pedido. Discúlpate y usa escalar_a_humano.'
    }

    const monto = enPesos(Number(pieza.price))
    const enlace = respuesta?.initPoint

    if (!enlace) {
      console.error('create-preference no devolvió initPoint')
      return `El pedido quedó registrado por ${monto} COP pero el enlace de pago no salió. ` +
             `Dile que alguien del equipo se lo manda en un momento y usa escalar_a_humano.`
    }

    /* El contraentrega también cobra por adelantado, pero sólo el envío. Un
       pedido que no cuesta nada hacer es un pedido que la mitad de las veces
       no se recibe, y esa devolución la paga el taller. */
    const abono = Number(respuesta?.abono ?? 0)
    const saldo = Number(respuesta?.saldo ?? 0)

    const texto = contraEntrega
      ? `Para confirmar tu pedido abonas ${enPesos(abono)}, que es el envío, y se descuenta del total.\n` +
        `Al recibirlo pagas ${enPesos(saldo)} en efectivo.\n\n${enlace}`
      : `Este es tu enlace para pagar los ${monto}:\n${enlace}`

    /* El enlace se manda aparte y no dentro de la respuesta del modelo: una
       URL larga reescrita por el modelo es una URL rota, y acá eso es una
       venta perdida. */
    const envio = await enviarTexto(telefono, texto, 'ia', desdeId)
    if (!envio.ok) {
      return `El pedido quedó registrado por ${monto} COP pero no se pudo enviar el enlace. ` +
             `Usa escalar_a_humano.`
    }

    if (contraEntrega) {
      return `Pedido registrado por ${monto} COP contra entrega, y el enlace del abono YA se lo ` +
             `enviaste — no lo repitas ni lo escribas tú. Explícale con tus palabras que abona ` +
             `${enPesos(abono)} del envío para confirmar, que eso se descuenta, y que al recibir ` +
             `paga ${enPesos(saldo)}. Si pregunta por qué se cobra, cuéntalo de frente: antes ` +
             `no se cobraba, pasaba que la pieza llegaba hasta la puerta y la persona ya no ` +
             `estaba o había cambiado de opinión, y el envío de ida y vuelta lo perdía el ` +
             `taller. Sin reprochar, y cerrando siempre en que no es plata de más porque se ` +
             `descuenta. Dile que apenas entre el abono le confirmas y le mandas la guía al ` +
             `despachar.`
    }

    return `Pedido registrado por ${monto} COP y el enlace de pago YA se lo enviaste — no lo repitas ` +
           `ni lo escribas tú. Confírmale el monto, dile que al pagar le llega la confirmación, y ` +
           `que si prefiere puede pagar contra entrega abonando sólo el envío.`
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

  // En paralelo: son cuatro consultas independientes.
  const [piezas, politicas, referral, cod] = await Promise.all([
    catalogo(), conocimiento(), referralDe(telefono), cifrasContraentrega(),
  ])
  const deDonde = origen(referral)

  const mensajes: any[] = [
    { role: 'system', content: instrucciones(piezas, politicas, deDonde, cod) },
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
        /* Lo que escribió el modelo, que sabe de qué venían hablando. El
           respaldo sólo aparece si no escribió nada: mejor una frase genérica
           que un silencio. */
        const suyo = String(args?.mensaje ?? '').trim()
        return suyo || 'Dame un momento, te comunico con alguien del equipo que te ayuda con eso. 🌿'
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
