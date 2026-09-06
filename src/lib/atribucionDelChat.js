/**
 * De qué anuncio vino una conversación de WhatsApp.
 *
 * ── Qué problema resuelve ────────────────────────────────────────────────
 *
 * El joyero cierra las ventas desde su WhatsApp personal, no desde el panel.
 * Eso funciona para la clienta y no para nadie más: esa venta no existe para
 * Meta ni para TikTok —ni pedido, ni conversión, ni atribución— y la campaña
 * que la trajo nunca se entera de que trajo algo. Ya pasó con la primera venta
 * real del negocio, el 5 de septiembre de 2026.
 *
 * La contrapartida es registrar el pedido después, a mano, desde el chat. Pero
 * un pedido creado a mano no sirve de nada si va pelado: sin el `ctwa_clid`,
 * Meta no puede acreditarle la venta al anuncio y volvemos al mismo sitio.
 *
 * Estas funciones sacan esos identificadores de la conversación, que es el
 * único sitio donde quedaron: Meta los manda en el `referral` del primer
 * mensaje y ahí se guardan.
 *
 * ── Por qué está escrito otra vez ───────────────────────────────────────
 *
 * `atribucionDe()` en `supabase/functions/_shared/reglas.ts` hace lo mismo
 * para Valentina. No se puede compartir: aquello corre en Deno y esto en el
 * bundle del navegador. Son las dos copias de siempre, y por eso esta lleva
 * sus propias pruebas.
 */

/**
 * Los identificadores del anuncio, tal como los guarda `orders`.
 *
 * @param referral el objeto `referral` de Meta, tal como llegó en el mensaje
 * @returns `{ ctwa_clid, anuncio_id }`, con `null` en lo que no venga
 */
export function atribucionDelReferral(referral) {
  if (!referral || typeof referral !== 'object') {
    return { ctwa_clid: null, anuncio_id: null };
  }

  const limpio = (v) => {
    const s = typeof v === 'string' ? v.trim() : '';
    return s || null;
  };

  return {
    /* El que de verdad importa: es lo que hay que devolverle a Meta para que
       le acredite la venta al anuncio. Sin él, la conversión llega huérfana. */
    ctwa_clid: limpio(referral.ctwa_clid),
    anuncio_id: limpio(referral.source_id),
  };
}

/**
 * ¿Vale la pena registrar este pedido para la medición?
 *
 * Un pedido sin `ctwa_clid` se puede crear igual —es una venta y hay que
 * anotarla— pero no le va a decir nada a Meta. Sirve para avisarlo en la
 * interfaz en vez de dejar creer que la atribución se recuperó.
 */
export function tieneComoAtribuirse(atribucion) {
  return !!atribucion?.ctwa_clid;
}

/**
 * El `referral` más antiguo de una conversación.
 *
 * El más antiguo y no el más reciente: Meta lo manda **sólo en el primer
 * mensaje** de cada conversación iniciada desde un anuncio, y si esa persona
 * volvió después por otro anuncio, el que trajo la venta que se está
 * registrando es el primero.
 *
 * @param supabase el cliente del panel
 * @param telefono el número tal como está en `whatsapp_conversaciones`
 */
export async function traerAtribucionDelChat(supabase, telefono) {
  if (!telefono) return { ctwa_clid: null, anuncio_id: null };

  const { data } = await supabase
    .from('whatsapp_conversaciones')
    .select('referral')
    .eq('phone_number', telefono)
    .not('referral', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return atribucionDelReferral(data?.referral);
}
