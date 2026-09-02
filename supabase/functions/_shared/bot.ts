/**
 * Valentina. El cerebro va por OpenRouter; el catálogo, las políticas, los
 * precios y los pedidos salen de la base, no del modelo, para que no
 * invente nada.
 */
import { admin, enviarImagen, enviarPlantilla, enviarTexto } from './wa.ts'
import {
  anuncioDe, atribucionDe, calcularTalla, cotizarOro, esContraentrega, esTelefono, piezaDelAnuncio,
  origen, piezasDelPedido, refDelTexto,
} from './reglas.ts'
import { correrElBucle } from './bucle.ts'

const MODELO = Deno.env.get('OPENROUTER_MODEL') || 'openai/gpt-5.6-luna-pro'
const MENSAJES_DE_CONTEXTO = 20

/* Topes del bucle de herramientas. Un agente sin freno es una factura sin
   freno. El último paso va sin herramientas, así siempre termina con algo
   que decirle al cliente. */
/** Más de tres fotos seguidas satura el chat. */
const MAX_FOTOS = 3

/* Cada cuánto hay que mirar el precio del oro. El joyero lo consulta a
   diario, pero NO cambia la cotización por movimientos chicos: "si mañana
   baja 5000 o sube 3000 no importa". Así que el dato guardado se usa tal
   cual; lo único que se vigila es que no esté abandonado. */

type Mensaje = { role: 'user' | 'assistant' | 'system'; content: string }

/** El catálogo real, tal cual está publicado ahora mismo. */
async function catalogo(): Promise<string> {
  /* `metal` y `piedra` se añadieron el 1 de septiembre de 2026, y no son un
     adorno: sin ellos el modelo tenía que ADIVINAR el metal leyendo la
     descripción. El 31 de agosto una clienta pidió tres veces "anillo en oro
     con esmeralda" y recibió dos anillos de plata como respuesta. El metal es
     la primera pregunta de una joyería —dos de cada cinco conversaciones de
     ese día fueron sobre eso— y no puede ir sólo insinuado en la prosa. */
  const { data } = await admin()
    .from('products')
    .select('name, category, price, description, stock, metal, piedra')
    .order('created_at', { ascending: false })

  if (!data?.length) return 'No hay piezas publicadas ahora mismo.'

  return data.map((p) => {
    const agotado = p.stock === 0 ? ' — AGOTADA, no la ofrezcas' : ''
    /* Entre paréntesis y junto a la categoría, no en una línea aparte: es
       donde el modelo ya mira para decidir qué ofrecer. */
    const senas = [p.category, p.metal, p.piedra].filter(Boolean).join(', ')
    return `- ${p.name} (${senas}): $${Number(p.price).toLocaleString('es-CO')} COP${agotado}` +
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
  /* El abono admite CERO, y el tope no.
   *
   * Cero abono es una decisión —desde el 1 de septiembre de 2026 el
   * contraentrega de Bogotá no cobra nada por adelantado— y hay que poder
   * distinguirla de «no tengo el dato». `null` sigue significando lo segundo,
   * y ahí Valentina no inventa una cifra. Un tope en cero, en cambio, no
   * significa nada útil: se trata como ausente y no se ofrece contraentrega. */
  const abonoValido = (v: unknown) => {
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 ? n : null
  }
  return { tope: valido(data?.tope_contraentrega), abono: abonoValido(data?.abono_envio) }
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

/**
 * La joya que esa persona vio en el anuncio, si se sabe cuál es.
 *
 * El `referral` de Meta trae el identificador del anuncio, no la pieza. El
 * puente es `ajustes_internos.anuncios_piezas`, una tabla de `id de anuncio →
 * uuid de pieza` que vive en la base y no en el código: Meta no deja editar el
 * enlace de un creativo publicado, así que cada cambio de anuncio trae un
 * identificador nuevo, y con esto puesto acá cada campaña nueva sería un
 * despliegue.
 *
 * Devuelve la fila del catálogo, no lo que diga la tabla: **el nombre y el
 * precio se leen del catálogo en el momento**. Una tabla con el precio escrito
 * dentro es una tabla que un día le promete a alguien un precio que ya no
 * existe.
 *
 * Y si la pieza está agotada devuelve `null` a propósito: abrir nombrando algo
 * que no se puede vender es peor que abrir preguntando.
 */
async function piezaQueVioEnElAnuncio(referral: any | null) {
  if (!referral) return null

  const { data: ajuste } = await admin()
    .from('ajustes_internos').select('valor').eq('clave', 'anuncios_piezas').maybeSingle()

  const id = piezaDelAnuncio(referral, ajuste?.valor)
  if (!id) {
    /* Que quede en el registro: es la única forma de enterarse de que se
       publicó un anuncio nuevo y nadie actualizó la tabla. */
    if (referral?.source_id) console.log('Anuncio sin pieza en la tabla · source_id:', referral.source_id)
    return null
  }

  const { data: pieza } = await admin()
    .from('products').select(CAMPOS_PIEZA).eq('id', id).maybeSingle()

  if (!pieza) { console.log('La tabla de anuncios apunta a una pieza que no existe:', id); return null }
  if (pieza.stock === 0) { console.log('La pieza del anuncio está agotada:', pieza.name); return null }

  return pieza
}

/** Cómo contárselo al modelo, para que abra reconociendo lo que vio. */
async function refDeMensajes(telefono: string): Promise<string | null> {
  const { data } = await admin()
    .from('whatsapp_conversaciones')
    .select('content')
    .eq('phone_number', telefono)
    .eq('role', 'user')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  return refDelTexto(data?.content)
}

function instrucciones(piezas: string, politicas: string, deDonde: string, cod: { tope: number | null; abono: number | null }, delAnuncio: { name: string; price: number } | null): string {
  return `Eres Valentina, la asesora de Aurem Gs Joyería, una joyería colombiana.
Escribes por WhatsApp a clientes reales. Hablas en español de Colombia, con
cercanía y sin adular. Mensajes cortos: dos o tres frases, salvo que estés
recapitulando un pedido.

CATÁLOGO PUBLICADO (es el único que existe):
${piezas}

CÓMO FUNCIONA EL NEGOCIO (es lo único que puedes afirmar sin consultar):
${politicas}
${deDonde ? `\nDE DÓNDE VIENE\n${deDonde}\nAbre reconociendo eso, con naturalidad — "vi que te interesó…" — y sigue por ahí.\nNO recites el anuncio ni repitas su texto: sólo demuestra que sabes qué vio.\nSi el anuncio prometía algo que no está en las políticas de arriba, NO lo\nconfirmes: dilo con calma y escala.\n` : ''}${delAnuncio ? `\nLA JOYA QUE VIO\nEl anuncio por el que escribió enseñaba esta pieza del catálogo de arriba:\n${delAnuncio.name} — ${enPesos(Number(delAnuncio.price))} COP.\n\nEsto cambia tu primer mensaje, y es lo más importante de esta conversación:\n- ABRE NOMBRÁNDOLA y llama a mostrar_pieza con "${delAnuncio.name}" en ese mismo\n  primer turno. Ya sabes qué quiere ver: enseñárselo.\n- NO preguntes qué busca, ni si quiere plata u oro, ni para quién es. Esa\n  persona ya eligió y ya pagamos por su clic; cada pregunta de más antes de\n  ver la joya es una razón para irse.\n- El nombre y los demás datos se piden DESPUÉS, cuando ya haya interés.\n- Si escribe pidiendo otra cosa, cambia de pieza con normalidad: ésta es el\n  punto de partida, no una jaula.\n` : ''}

REGLAS QUE NO SE ROMPEN
1. Nunca inventes una pieza, un precio, un material, un quilataje ni un plazo.
   Si no está arriba, no existe: dilo y ofrece lo que sí hay.
2. Si no entiendes algo, NO respondas "no te entendí". Repite lo que creas
   haber entendido y pregunta por lo que falta. Ejemplo: si dice "pago de una
   vez", eso significa que quiere pagar ya — confírmale el medio de pago.
3. Sobre envíos, pagos, garantía y plazos di SÓLO lo que está arriba, tal
   como está. Si te preguntan algo que no aparece ahí, no lo deduzcas ni lo
   inventes: dilo con naturalidad y usa escalar_a_humano.
4. Para cerrar un pedido necesitas: las piezas, la talla de cada anillo,
   nombre completo, dirección, ciudad y correo. Pídelos de a poco, no todos
   de golpe.
4b. UN PEDIDO PUEDE LLEVAR VARIAS PIEZAS. Si quiere dos o tres, van todas en
   el mismo pedido y en un solo pago, no en pedidos separados. Y cada anillo
   lleva SU talla: si son para personas distintas, pregunta la de cada uno y
   no supongas que es la misma. Si quiere dos iguales, eso es cantidad 2 de
   la misma pieza, no dos piezas.
5. EL CORREO. Pídelo siempre y di para qué es: ahí le llega el comprobante
   del pago y la confirmación del pedido con el detalle de la pieza. Si no lo
   da, o escribe algo que no parece un correo, insiste UNA sola vez.
   Si sigue sin darlo, déjalo ahí: cierra el pedido sin correo y dile que
   entonces le llega todo por WhatsApp. NUNCA dejes un pedido sin cerrar por
   un correo — vale mucho más la venta que el dato.
6. Cuando tengas todo, recapitula y usa la herramienta crear_pedido.
6b. EL CONTRAENTREGA: ${cod.tope ? `hasta ${enPesos(cod.tope)}` : 'no lo ofrezcas, no tengo el tope a mano'}.
${cod.abono === 0
  ? `   NO SE ABONA NADA. El contraentrega no pide un peso por adelantado: la
   clienta paga el precio publicado, completo y en efectivo, cuando recibe la
   pieza. Nada de envío aparte, nada de abono, nada de "para confirmar".
   DILO COMO ARGUMENTO, no como un dato administrativo: es lo que la hace
   confiar cuando es su primera compra y no nos conoce. "Pagas cuando la
   tengas en la mano" vale más que cualquier explicación.
   Si te pregunta por qué no cobramos nada antes, la respuesta es simple: en
   Bogotá la entrega la hacemos nosotros. No prometas eso mismo fuera de
   Bogotá, donde el pago va por anticipado.`
  : cod.abono
  ? `   Lleva un abono de ${enPesos(cod.abono)} que confirma el pedido y se descuenta del total.
   ESE ABONO ES ${enPesos(cod.abono)} — no lo redondees, no digas "unos", no digas
   "aproximadamente" y NUNCA des otra cifra.`
  : `   NO TIENES EL DATO DEL ABONO. Di que lo confirmas y no inventes un número.`}
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
9. EL NOMBRE, UNA SOLA VEZ. Pregúntalo con naturalidad — "¿con quién tengo
   el gusto?" — pero **después** de haberle mostrado algo, no antes: primero
   la joya, luego los datos. Y si no te lo dan, SIGUE SIN ÉL y no lo vuelvas
   a pedir hasta que estés cerrando el pedido, donde sí hace falta.
   El 31 de agosto de 2026 lo preguntaste SEIS veces en una conversación —en
   seis mensajes distintos, a una persona que nunca lo dio— y eso es lo que
   hace que suene un robot. Cuando te lo den, úsalo: llamar a alguien por su
   nombre da más cercanía que cualquier fórmula.
   Pero NO deduzcas el género del nombre ni de lo que compra. Mucha gente
   compra joyería de regalo, y arrancar con "bienvenida, linda" cuando es un
   señor comprándole a su esposa arruina el primer mensaje. Habla en formas
   neutras ("¿cómo te ayudo?", "quedas atendido/a") y evita "bienvenida",
   "linda" o "reina". Si la persona dice cómo quiere que le hablen, o se
   nombra a sí misma en femenino o masculino, síguelo: ahí ya no adivinas.
9b. NO REPITAS UNA PREGUNTA QUE YA HICISTE. Mira los mensajes de arriba antes
   de escribir: si ya preguntaste algo y no te contestaron, no lo vuelvas a
   preguntar — sigue con lo que sí te dijeron. Preguntar dos veces lo mismo
   se lee como que no estabas leyendo.
10. TIENES FOTOS. Cuando pidan ver algo, cuando duden entre piezas o cuando
   una imagen ayude a decidir, usa mostrar_pieza. No describas una pieza
   pudiendo mostrarla. Nunca digas que no puedes mandar fotos.
10b. CÓMO SE ESCRIBE EN WHATSAPP. La negrita lleva UN asterisco —*así*— y no
   dos. Nada de Markdown de escritorio: ni **negritas**, ni ## títulos, ni
   viñetas con guiones. Estás en un chat, no en un documento.
10c. CUANDO PIDEN UN METAL. Si te piden oro —o plata, u oro blanco, o oro
   amarillo—, contesta con lo que HAY EN ESE METAL en el catálogo de arriba,
   ordenado de menor a mayor precio. Mira la columna de metal de cada pieza
   antes de responder: hay piezas en oro que no son anillos y anillos que son
   de los dos metales, y todo eso cuenta.
   NUNCA respondas una petición de oro enseñando piezas de plata. El 31 de
   agosto de 2026 alguien pidió tres veces "anillo en oro con esmeralda" y
   recibió dos anillos de plata como si fueran la respuesta; eso se lee como
   que no la estabas escuchando.
   Si en su metal no hay NADA que se acerque a lo que pide, no te lo inventes
   ni lo despaches con "lo hacemos a medida" a secas: dile con claridad qué sí
   hay en ese metal, y usa escalar_a_humano para que el joyero le resuelva la
   inquietud —él sabe qué se puede hacer y por cuánto—.
10d. CIERRA. NO TE QUEDES EN ENSEÑAR.
   El 1 de septiembre de 2026 hubo catorce conversaciones y CERO pedidos.
   Todas terminaban igual: fotos, precios y "¿cuál te gusta más?". Y en
   ninguna de las catorce se mencionó que no hay que pagar nada por
   adelantado. Estás enseñando un catálogo cuando lo que hace falta es
   vender, y son personas que llegaron por un anuncio que ya se pagó.
   Cuando alguien mire una pieza con interés —la nombra, pregunta el precio,
   pide ver más, dice que le gusta— haz DOS cosas en el mismo mensaje:
   - **Dile lo que se lleva sin arriesgar nada.** En Bogotá no paga un peso
     hasta tener la pieza en la mano. Es el mejor argumento que tenemos con
     alguien que no nos conoce, y no lo estás usando NUNCA.
   - **Propón el pedido de verdad**, no "¿cuál te gusta más?". Algo como
     "¿te lo aparto y te lo llevamos?" o "¿lo dejamos pedido?". Una pregunta
     que se responda con sí, no una que la deje mirando vitrina.
   Propón UNA vez y lee la respuesta. Si dice que lo va a pensar, no
   insistas ni repitas la oferta: responde lo que pregunte y déjala ir con
   buena cara. Vender es ofrecer, no perseguir.
10e. QUIEN QUIERE COMPRAR PARA REVENDER NO ES UNA CLIENTA MÁS. Si alguien
   habla de un emprendimiento, de una tienda, de comprar por cantidad o de
   precios al por mayor, ESCALA. No le contestes con el precio al detal
   como si fuera una compra suelta: no tienes precios de mayoreo y el
   joyero sí sabe qué se puede hacer. Pasó el 1 de septiembre de 2026 —una
   señora escribió contando que empezaba un emprendimiento de joyería con
   esmeraldas, recibió tres piezas al detal y se fue.
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

23. CUANDO UNA PERSONA YA ATENDIÓ. En el historial hay mensajes marcados
   con [Lo escribió una persona del equipo]. Eso NO lo dijiste tú: lo dijo
   alguien del taller mientras llevaba la conversación.
   Todo lo que esa persona acordó vale y es firme. Si dio un precio —de
   plata, de una pieza a medida, de cualquier cosa que tú no sabes
   calcular— ese precio queda, aunque tú no habrías podido darlo. No lo
   recalcules, no lo redondees, no lo contradigas y no lo vuelvas a
   consultar. Y que te lo hayan dejado dicho tampoco te habilita a cotizar
   otras piezas: tus reglas siguen siendo las mismas.
   Si algo de lo acordado hay que cambiar, o el cliente pide otra cosa que
   tampoco puedes resolver, usa escalar_a_humano otra vez.
   Retoma con naturalidad, sin anunciar que volviste ni explicar que antes
   respondía otra persona. Para el cliente es la misma conversación.

24. Si el primer mensaje trae algo entre corchetes como [ref: tiktok], es una
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
          /* Una lista, aunque casi siempre traiga una sola. Un pedido de dos
             anillos para dos personas lleva dos tallas distintas, y por eso
             la talla va DENTRO de cada pieza y no suelta en el pedido: con
             una sola talla para todo, alguna se fabrica mal. */
          piezas: {
            type: 'array',
            description: 'Las piezas del pedido. Una sola casi siempre; varias si pidió más de una.',
            items: {
              type: 'object',
              properties: {
                producto: { type: 'string', description: 'Nombre exacto de la pieza, tal como aparece en el catálogo' },
                talla: { type: 'string', description: 'Sólo si es anillo. La de ESTA pieza.' },
                cantidad: { type: 'number', description: 'Cuántas de esta misma pieza. Por defecto una.' },
              },
              required: ['producto'],
            },
          },
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
          /* Casi nunca hace falta: la conversación ya va por su número. Pero
             desde el 31 de agosto de 2026 hay contactos que llegan SIN número
             —Meta manda un identificador cuando el clic viene de Instagram o
             Facebook— y a ésos hay que pedírselo, o el pedido sale sin forma
             de llamar a nadie para coordinar la entrega. */
          telefono: { type: 'string', description: 'Sólo si el sistema te dijo que esta conversación no trae número. Es el celular que te dé el cliente para coordinar la entrega.' },
          metodo_pago: { type: 'string', enum: ['Mercado Pago', 'Contra entrega'] },
        },
        required: ['piezas', 'nombre', 'direccion', 'ciudad', 'metodo_pago'],
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
            /* «Reconoce lo que pidió» se escribió pensando en las fotos, y con
               una pregunta de texto el modelo lo entendía como repetirla:
               «Quieres saber dónde estamos ubicados. Te paso con alguien»,
               «Preguntas si manejamos algún sistema de crédito. Te paso con
               alguien». Suena a formulario justo donde hace falta que suene a
               persona. Visto el 31 de agosto de 2026, dos veces en un día. */
            description: 'Lo que se le dice al cliente, en tu voz. Dos frases cortas. NO le repitas su propia pregunta —ni con otras palabras—: eso se lee como un formulario. Da un paso hacia la respuesta con lo que sí sabes, y luego dile que lo pasas con alguien del equipo. Si mandó una foto, di qué viste en ella.',
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
    const t = calcularTalla(args?.medida, args?.unidad)

    if (!t.ok) {
      if (t.motivo === 'medida_invalida') {
        return 'Esa medida no se entiende. Pregúntale cómo midió y con qué unidad.'
      }
      const donde = t.motivo === 'muy_pequena'
        ? `queda por debajo de la talla ${t.limite}`
        : `pasa la talla ${t.limite}`
      return `Esa medida (${unDecimal(t.circunferencia)} mm de circunferencia) ${donde}. ` +
             `Dile que se la fabricamos a la medida y que le confirmas por interno.`
    }

    /* El matiz importa: con la tolerancia de la guía, la talla elegida puede
       quedar un pelo por debajo del dedo. Decir «se toma la mayor» en ese caso
       sería mentir, y es justo el detalle que una clienta comprueba. */
    const comoQuedo = t.justa
      ? 'Cae justo en esa talla. '
      : t.ajustada
        ? 'Quedó a un pelo por encima de esa talla y se toma esa: la diferencia es menor que lo que un dedo cambia entre la mañana y la tarde. '
        : 'Quedó entre dos tallas y se toma la mayor, porque un anillo holgado se acomoda y uno apretado no entra. '

    return `La talla es ${t.talla}. (${unDecimal(t.circunferencia)} mm de circunferencia, ` +
           `${unDecimal(t.diametro)} mm de diámetro interior.) ` +
           comoQuedo +
           `Díselo con naturalidad y sigue con el pedido. No le preguntes otra vez qué talla es: ya la sabes.`
  }

  if (nombre === 'cotizar_oro') {
    const { data: precios } = await db.from('taller_precios')
      .select('precio_gramo_oro, recargo_por_gramo, gramos_minimos, actualizado_en')
      .maybeSingle()

    if (!precios) {
      console.error('No hay fila en taller_precios')
      return 'No tengo la lista de precios a mano. Usa escalar_a_humano.'
    }

    const c = cotizarOro(args?.gramos, precios, Date.now())

    if (!c.ok) {
      if (c.motivo === 'sin_gramos') {
        return 'No dijo cuántos gramos. Pregúntale por el diseño y el tamaño, o escala para que el taller lo calcule.'
      }
      if (c.motivo === 'bajo_el_minimo') {
        return `Son ${c.gramos} gramos, menos del mínimo de ${c.minimo} para cotizar por gramo. ` +
               `Una pieza así se cobra por pieza, no por peso. Dile que lo consultas con el taller y usa escalar_a_humano.`
      }
      console.error(`Precio del oro con ${Math.round(c.dias)} días sin actualizar: no se cotiza`)
      return 'El precio del oro que tengo está viejo y no quiero darte un número equivocado. Usa escalar_a_humano.'
    }

    const aviso = c.avisar
      ? ` (Ojo: el precio base lleva ${Math.round(c.dias)} días sin actualizarse.)`
      : ''

    return `Son ${enPesos(c.total)} por ${c.gramos} gramos de oro — ${enPesos(c.porGramo)} el gramo.${aviso} ` +
           `Ese precio ya incluye diseño, fundición y terminado. ` +
           `Si la pieza lleva esmeraldas o diamantes eso suma aparte y NO lo sabes calcular: dilo y escala. ` +
           `Dale el número redondeado y con naturalidad, sin desglosar el recargo.`
  }

  if (nombre === 'escalar_a_humano') {
    await db.from('chat_takeover').upsert(
      /* started_at se renueva a propósito: con upsert, si no se pone, una
         conversación que ya se había escalado antes conserva la fecha vieja
         y el temporizador de liberación arrancaría vencido. */
      {
        phone_number: telefono,
        is_active: true,
        admin_email: 'valentina@bot',
        reason: args?.motivo ?? null,
        started_at: new Date().toISOString(),
        ended_at: null,
      },
      { onConflict: 'phone_number' },
    )
    /* Y se avisa. Marcar la conversación no sirve de nada si nadie mira el
       panel: hasta ahora Valentina decía "te comunico con alguien del equipo"
       y ese alguien no se enteraba. El cliente quedaba esperando a una
       persona que no sabía que la estaban esperando. */
    await avisarQueEsperan(telefono, String(args?.motivo ?? 'Sin motivo anotado'))
    return 'Dile que en un momento alguien del equipo se comunica. No sigas preguntando.'
  }

  if (nombre === 'crear_pedido') {
    const pedidas = piezasDelPedido(args)

    if (!pedidas.length) {
      return 'No dijiste qué piezas. Recapitula con el cliente qué quiere y vuelve a intentarlo.'
    }

    /* El precio sale del catálogo, no de lo que diga el modelo. Es la
       diferencia entre cobrar lo que vale y cobrar lo que el modelo recordó. */
    const items: Array<{ id: string; name: string; price: number; quantity: number; talla: string | null }> = []
    const noEncontradas: string[] = []

    for (const p of pedidas) {
      const encontrada = await buscarPieza(p.producto)
      if (!encontrada) { noEncontradas.push(p.producto); continue }
      if (encontrada.stock === 0) { noEncontradas.push(`${encontrada.name} (agotada)`); continue }

      items.push({
        id: encontrada.id,
        name: encontrada.name,
        price: Number(encontrada.price),
        quantity: p.cantidad,
        talla: p.talla,
      })
    }

    /* Si alguna falla NO se crea nada. Un pedido a medias es peor que
       ninguno: el cliente cree que lleva dos piezas, paga por una, y el
       reclamo llega cuando abre la caja. */
    if (noEncontradas.length) {
      return `No pude tomar el pedido: ${noEncontradas.join(', ')} no está en el catálogo o está agotada. ` +
             `Díselo, ofrécele lo que sí hay, y vuelve a crear el pedido cuando esté claro.`
    }

    /* El número al que se le va a entregar.
     *
     * Normalmente es el de la conversación. Pero hay contactos que llegan sin
     * teléfono —Meta manda `CO.1287538963396593` cuando el clic viene de
     * Instagram o Facebook— y con eso en `customer_phone` el pedido sale sin
     * forma de llamar a nadie: el domiciliario se queda en la puerta sin poder
     * marcar. Antes de que existiera este freno, el asesor tuvo que pedir el
     * número a mano, y le costó cuatro mensajes y veinte minutos. */
    const telefonoDelPedido = esTelefono(telefono)
      ? telefono
      : (esTelefono(args?.telefono) ? String(args.telefono).trim() : null)

    if (!telefonoDelPedido) {
      return 'Esta conversación no trae número de celular, y sin él no se puede coordinar la entrega. ' +
             'Pídeselo con naturalidad —"¿a qué número te podemos escribir para coordinar la entrega?"— ' +
             'y vuelve a crear el pedido pasándolo en `telefono`. No inventes uno ni cierres sin él.'
    }

    const contraEntrega = esContraentrega(args.metodo_pago)

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
          items,
          buyer: {
            name: args.nombre,
            phone: telefonoDelPedido,
            /* Sin correo el pedido sigue: create-preference sólo exige uno de
               los dos, y el teléfono a estas alturas ya está garantizado —el
               freno de arriba no deja llegar hasta acá sin uno—. Lo que se
               pierde es el comprobante de Mercado Pago, no la venta. */
            email: args.correo || null,
            address: args.direccion,
            city: args.ciudad,
          },
          paymentMethod: contraEntrega ? 'cod' : 'mp',
          /* De dónde viene la venta. Iba sólo dentro de la nota —'Pedido
             tomado por Valentina'—, que es texto para leer, no un dato para
             contar: por eso el embudo de WhatsApp daba cero conversión
             aunque Valentina estuviera cerrando pedidos. */
          canal: 'whatsapp',
          /* Los identificadores del anuncio van como datos aparte de la nota:
             la nota es para leerla, esto es para devolvérselo a Meta cuando
             se cobre y para poder contar ventas por origen. */
          atribucion: { ...atribucionDe(referral), utm_source: await refDeMensajes(telefono) },
          notes: [
            /* Un resumen legible para el panel. Las tallas de verdad viven
               en order_items, una por pieza; esto es para que quien mire el
               pedido de un vistazo las vea sin abrir nada. */
            items.filter((i) => i.talla).map((i) => `${i.name}: talla ${i.talla}`).join(' · ') || null,
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

      /* Una sola ficha por persona.
       *
       * Si la conversación llegó sin número, el cliente acaba de darlo. Se
       * escribe en LA MISMA fila —la que Meta creó con su identificador— para
       * que no queden dos: la del identificador, con su nombre y su historia,
       * y otra que crearía el disparador del pedido con el teléfono suelto.
       *
       * El `is('phone', null)` evita pisar un número ya confirmado, y si ese
       * teléfono ya existe en otra fila la unicidad rechaza el UPDATE: quedan
       * dos fichas, que es raro y recuperable a mano. Fundirlas automáticamente
       * sería decidir cuál de los dos nombres y direcciones gana, y eso no lo
       * puede adivinar el bot. */
      if (!esTelefono(telefono)) {
        const { error } = await db.from('customers')
          .update({ phone: telefonoDelPedido, updated_at: new Date().toISOString() })
          .eq('wa_id', telefono)
          .is('phone', null)
        if (error) console.log('No se pudo enlazar el teléfono con el contacto:', error.message)
      }
    } catch (e) {
      console.error('create-preference falló:', e instanceof Error ? e.message : e)
      return 'Hubo un problema al registrar el pedido. Discúlpate y usa escalar_a_humano.'
    }

    const total = items.reduce((suma, i) => suma + i.price * i.quantity, 0)
    const monto = enPesos(total)
    /* Contraentrega sin abono: no hay enlace porque no hay nada que cobrar
       hoy. El pedido ya quedó confirmado y lo único que falta es entregarlo.
       Va ANTES del control del enlace, que si no lo trataría como un fallo. */
    if (respuesta?.sinAbono) {
      return `Pedido registrado por ${monto} COP contra entrega, y confirmado: no hay nada que ` +
             `pagar por adelantado. Díselo así, que es la mejor parte — paga los ${monto} completos ` +
             `en efectivo cuando reciba la pieza, y no le pedimos ni un peso antes. NO le mandes ` +
             `ningún enlace ni le hables de abono: ya no existe. Recuérdale el plazo de entrega y ` +
             `dile que le avisas cuando vaya en camino.`
    }

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
 * Le avisa al equipo que hay una conversación esperando.
 *
 * Va a quien tenga acceso al panel, leído de auth.users, y no a una lista
 * escrita a mano: así el día que entre alguien nuevo al equipo empieza a
 * recibir los avisos sin que nadie se acuerde de configurarlo.
 *
 * Nunca lanza. El cliente ya recibió su respuesta y la conversación ya quedó
 * marcada; que falle el correo no puede deshacer nada de eso, sólo dejarlo
 * anotado en el log.
 */
async function avisarQueEsperan(telefono: string, motivo: string): Promise<void> {
  const db = admin()

  const { data: cliente } = await db
    .from('customers').select('name').eq('phone', telefono).maybeSingle()

  /* Las dos vías van por separado a propósito. Antes el WhatsApp colgaba de
     que hubiera correos de admin, y si algún día no los hubiera se caerían
     las dos por el mismo motivo. Un aviso que no sale es un cliente
     esperando; no puede depender de la otra mitad.

     El WhatsApp primero, que es el que suena. El correo queda como registro
     y con los últimos mensajes, pero nadie mira el correo cada diez minutos:
     una conversación que espera dos horas es un cliente que se enfrió, y con
     campañas encendidas, un cliente por el que se pagó. */
  try {
    await avisarPorWhatsApp(telefono, cliente?.name ?? null, motivo)
  } catch (e) {
    console.error('No se pudo avisar la escalada por WhatsApp:', e instanceof Error ? e.message : e)
  }

  try {
    const secreto = Deno.env.get('CORREO_SECRETO')
    if (!secreto) {
      console.error('escalada: falta CORREO_SECRETO, no sale el correo')
      return
    }
    const base = Deno.env.get('APP_URL') ?? 'https://www.auremgsjoyeria.com'

    const { data: usuarios } = await db.auth.admin.listUsers()
    const destinos = (usuarios?.users ?? [])
      .map((u) => u.email)
      .filter((e): e is string => !!e)

    if (!destinos.length) {
      console.error('escalada: no hay a qué correo avisar')
      return
    }

    /* Los últimos mensajes van dentro del correo. Sin ellos habría que abrir
       el panel sólo para saber si corre prisa, y el aviso serviría nada más
       para mandar a mirar a otro sitio. */
    const { data: hilo } = await db
      .from('whatsapp_conversaciones')
      .select('role, content')
      .eq('phone_number', telefono)
      .order('created_at', { ascending: false })
      .limit(4)

    const ultimos = (hilo ?? []).reverse()
      .filter((m) => m.content)
      .map((m) => ({
        de: m.role === 'user' ? 'cliente' : 'valentina',
        texto: String(m.content).slice(0, 400),
      }))

    const hora = new Date().toLocaleString('es-CO', {
      day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit',
      timeZone: 'America/Bogota',
    })

    const res = await fetch(`${base}/api/correo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-correo-secreto': secreto },
      body: JSON.stringify({
        plantilla: 'chat-escalado',
        para: destinos,
        /* El teléfono más la hora redondeada al minuto: dos escaladas
           seguidas del mismo chat no llenan la bandeja, pero una de mañana
           sí vuelve a avisar. */
        referencia: `${telefono}:${new Date().toISOString().slice(0, 16)}`,
        datos: { nombre: cliente?.name ?? null, telefono, motivo, ultimos, hora },
      }),
    })

    if (!res.ok) {
      console.error(`escalada: api/correo respondió ${res.status}`)
      return
    }
    console.log(`Escalada avisada a ${destinos.length} persona(s):`, telefono)
  } catch (e) {
    console.error('No se pudo avisar la escalada:', e instanceof Error ? e.message : e)
  }
}

/**
 * El mismo aviso, al celular de quien tiene que atender.
 *
 * Va por plantilla porque el equipo no le escribe al número de la joyería:
 * su ventana de 24 horas está cerrada siempre, y fuera de ella Meta sólo
 * deja plantillas aprobadas.
 *
 * NO se anota en el hilo de conversaciones. Si se anotara, cada aviso
 * abriría una conversación falsa en la bandeja —el joyero apareciendo como
 * cliente suyo— y el inbox de atención se llenaría de ruido justo el día que
 * más clientes escriben.
 *
 * Los números viven en ajustes_internos, no en el código: cambian cuando
 * entra o sale alguien del equipo, y eso no puede exigir un despliegue.
 */
async function avisarPorWhatsApp(
  telefono: string,
  nombre: string | null,
  motivo: string,
): Promise<void> {
  const { data } = await admin()
    .from('ajustes_internos').select('valor').eq('clave', 'telefonos_avisos').maybeSingle()

  const numeros = String(data?.valor ?? '')
    .split(/[,\s]+/).map((n) => n.replace(/\D/g, '')).filter((n) => n.length >= 10)

  if (!numeros.length) return   // nadie configurado: el correo ya salió

  const quien = String(nombre ?? '').trim() || telefono
  /* Meta rechaza una variable vacía y corta los mensajes largos: el motivo
     lo escribe el modelo y puede irse de largo. */
  const porque = motivo.trim().slice(0, 180) || 'Sin motivo anotado'

  for (const numero of numeros) {
    const envio = await enviarPlantilla(
      numero,
      'aviso_equipo',
      // {{1}} a quién se avisa · {{2}} el cliente · {{3}} por qué
      ['Equipo', quien, porque],
      null,
      undefined,
      false,   // sin anotar en la bandeja
    )
    if (!envio.ok) console.error(`No se pudo avisar a ${numero}:`, envio.error)
  }
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
    .select('role, content, enviado_por')
    .eq('phone_number', telefono)
    .order('created_at', { ascending: false })
    .limit(MENSAJES_DE_CONTEXTO)

  /* Lo que escribió una persona va marcado.
     
     Cuando alguien del equipo toma el control, sus mensajes se guardan como
     'assistant' igual que los del bot — y sin distinguirlos, al devolverle
     la conversación Valentina los lee como propios.
     
     Eso importa justo donde más duele. El equipo toma el control sobre todo
     para cotizar plata y piezas con piedras, que es lo único que ella tiene
     prohibido hacer. Al volver, veía "su propio" mensaje dando un precio
     que no sabe calcular: podía recalcularlo, contradecirlo, o darse por
     habilitada para seguir cotizando.
     
     Con la marca, el precio que dio una persona es un hecho acordado que
     ella respeta, no un cálculo suyo que puede rehacer. */
  const conversacion: Mensaje[] = (historial ?? []).reverse()
    .filter((m) => m.content)
    .map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.role !== 'user' && m.enviado_por === 'humano'
        ? `[Lo escribió una persona del equipo] ${m.content}`
        : String(m.content),
    }))

  // En paralelo: son cuatro consultas independientes.
  const [piezas, politicas, referral, cod] = await Promise.all([
    catalogo(), conocimiento(), referralDe(telefono), cifrasContraentrega(),
  ])
  const deDonde = origen(referral)
  /* Va después y no en el Promise.all porque depende del referral. Cuesta dos
     consultas más, y sólo en las conversaciones que vienen de un anuncio. */
  const delAnuncio = await piezaQueVioEnElAnuncio(referral)

  const mensajes: any[] = [
    { role: 'system', content: instrucciones(piezas, politicas, deDonde, cod, delAnuncio) },
    ...conversacion,
  ]

  return correrElBucle(mensajes, {
    llamarModelo,
    ejecutarHerramienta: (nombre, args) => ejecutarHerramienta(nombre, args, telefono, desdeId),
    herramientas: HERRAMIENTAS,
    registrar: (linea) => console.log(linea),
    avisar: (linea) => console.error(linea),
  })
}
