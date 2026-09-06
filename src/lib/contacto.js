/**
 * Cómo se llama, en pantalla, quien escribe por WhatsApp.
 *
 * ── Qué problema resuelve ────────────────────────────────────────────────
 *
 * Desde el 31 de agosto de 2026, con la pauta encendida, Meta manda
 * `CO.1287538963396593` en vez de un teléfono cuando el clic viene de
 * Instagram o de Facebook. La lista de chats pintaba ese identificador tal
 * cual, como si fuera un nombre: `CO.38364…` truncado, y debajo, de subtítulo,
 * el mismo identificador otra vez.
 *
 * No es sólo feo. Esa fila es un lead que llegó por un anuncio —el mejor que
 * hay— y en la lista se ve como basura de sistema, indistinguible de un error.
 *
 * ── Por qué `esTelefono` está escrito dos veces ──────────────────────────
 *
 * La otra copia es `esTelefono` en `supabase/functions/_shared/reglas.ts`, que
 * es la que decide si un contacto se guarda en `customers.phone` o en
 * `customers.wa_id`. No se pueden compartir: aquélla corre en Deno y ésta en
 * el bundle del navegador. Es la misma situación que la talla de anillo, y se
 * resuelve igual — `contacto.test.js` las compara entrada por entrada y tumba
 * el build si dejan de coincidir. **Si tocas una, toca la otra.**
 */

/**
 * ¿Esto es un teléfono de verdad, o un identificador de Meta?
 *
 * Copia exacta de `esTelefono` en `_shared/reglas.ts`. Ver arriba.
 */
export function esTelefono(v) {
  const s = String(v ?? '').trim();
  if (!s) return false;
  /* Un identificador trae letras o puntos; un teléfono, sólo dígitos y los
     adornos con los que la gente los escribe. */
  if (!/^\+?[\d\s()-]+$/.test(s)) return false;
  const digitos = s.replace(/\D/g, '');
  return digitos.length >= 10 && digitos.length <= 15;
}

/**
 * Con qué dos líneas se pinta un contacto en la lista y en la cabecera.
 *
 * Siempre devuelve un `nombre` con algo dentro: una fila sin nombre es una
 * fila que no se puede señalar en voz alta, y por ahí se pierde un chat.
 *
 * @param contacto la fila de la lista (`customer_name`, `phone_number`)
 * @returns `{ nombre, detalle, anonimo }` — `detalle` puede ser `null`
 */
export function nombreVisible(contacto) {
  const nombre = (contacto?.customer_name || '').trim();
  const id = (contacto?.phone_number || '').trim();
  const telefono = esTelefono(id);

  if (nombre) {
    /* El teléfono debajo del nombre sirve para marcar; el identificador de
       Meta no sirve para nada de eso, así que no se enseña. */
    return { nombre, detalle: telefono ? id : null, anonimo: false };
  }

  /* Sin nombre pero con teléfono: el número ES el nombre. Es lo que el joyero
     lee en voz alta cuando llama. */
  if (telefono) return { nombre: id, detalle: null, anonimo: false };

  /* Sin nombre y sin teléfono: llegó de un anuncio de Instagram o de Facebook
     y Meta no soltó el número. Decirlo vale más que enseñar el identificador,
     que no se puede marcar, ni buscar, ni leer. */
  return { nombre: 'Sin nombre', detalle: 'Llegó por Instagram o Facebook', anonimo: true };
}

/**
 * La letra del avatar.
 *
 * `null` cuando no hay ninguna que valga: la inicial de `CO.1287…` sería una
 * «C» que no significa nada y que además saldría igual en todos ellos. Quien
 * lo llame que pinte el icono de persona.
 */
export function inicialDe(contacto) {
  const { nombre, anonimo } = nombreVisible(contacto);
  if (anonimo) return null;
  const letra = nombre.trim()[0];
  return /[a-záéíóúüñ]/i.test(letra || '') ? letra.toUpperCase() : null;
}
