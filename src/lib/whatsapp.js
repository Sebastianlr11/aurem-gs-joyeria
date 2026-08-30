import { useEffect, useState } from 'react';
import { origenCorto } from './atribucion';

export const WA_NUMBER = '573115761896';

/* `typeof navigator` y no `navigator` a secas: esto también se evalúa en el
   build, cuando `scripts/prerenderizar.mjs` pinta la portada en Node. Ahí no
   hay teléfono que detectar y la respuesta correcta es "no". */
export const isMobile = () =>
  typeof navigator !== 'undefined' &&
  /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(
    navigator.userAgent
  );

/** El enlace pelado, sin mirar el navegador. Lo comparten `waUrl` y `useWaUrl`. */
const enlace = (texto) => `https://wa.me/${WA_NUMBER}?text=${encodeWA(texto)}`;

const encodeWA = (text) =>
  text.replace(/[&=+#%?]/g, encodeURIComponent)
      .replace(/ /g, '%20')
      .replace(/\n/g, '%0A');

/**
 * Genera URL de WhatsApp.
 * Recibe { mobile, desktop } para enviar mensaje con emojis en móvil
 * y sin emojis en PC (WhatsApp Web no los renderiza bien por URL).
 * También acepta un string simple para ambos.
 */
export const waUrl = (msg) => {
  const base = typeof msg === 'string'
    ? msg
    : isMobile() ? msg.mobile : msg.desktop;

  /* Si la persona llegó desde un anuncio, el mensaje lo lleva anotado.
     No es decoración: TikTok no manda ningún identificador cuando su anuncio
     abre WhatsApp —Meta sí, con el ctwa_clid— así que sin esta marca no hay
     forma de saber que la conversación empezó en un anuncio de TikTok.
     Va entre corchetes al final, donde se lee como una referencia y no como
     parte de lo que la persona quiso decir. */
  let text = base;
  try {
    const origen = origenCorto();
    if (origen) text = `${base}\n\n[ref: ${origen}]`;
  } catch {
    /* Sin almacenamiento no hay marca; el mensaje sale igual. */
  }

  return enlace(text);
};

/**
 * El mismo enlace, pero seguro de pintar en HTML prerenderizado.
 *
 * Desde el 30 de agosto de 2026 la portada se pinta en el build con
 * `react-dom/server` (ver `scripts/prerenderizar.mjs`), y ahí no hay
 * navegador: `isMobile()` no puede saber nada y `origenCorto()` no tiene
 * dónde leer. `waUrl()` devolvería una cosa en el build y otra en el celular
 * de la clienta, y eso es un **desajuste de hidratación**: React descarta el
 * HTML que ya estaba pintado y vuelve a construir el árbol entero desde cero
 * — justo la espera que el prerenderizado viene a quitar.
 *
 * Así que el primer render es siempre el mismo en los dos lados —el mensaje
 * de escritorio, sin la marca del anuncio— y en cuanto el componente monta se
 * cambia por el bueno. Lo que cambia es un `href`: no se ve, no mueve nada de
 * sitio, y nadie alcanza a tocar el botón en ese milisegundo.
 *
 * Sólo hace falta en lo que se prerenderiza —Hero, Footer, Reviews y el botón
 * flotante—. En el catálogo, la ficha o el panel `waUrl()` se sigue llamando
 * directo: esas pantallas se arman en el navegador y ahí no hay dos renders
 * que cuadrar.
 */
export function useWaUrl(msg) {
  const movil = typeof msg === 'string' ? msg : msg.mobile;
  const escritorio = typeof msg === 'string' ? msg : msg.desktop;

  /* El de escritorio y sin `[ref:]`, que es exactamente lo que sale del
     build: sin `navigator` `isMobile()` da falso, y sin `localStorage`
     `origenCorto()` no devuelve nada. */
  const [url, setUrl] = useState(() => enlace(escritorio));

  // eslint-disable-next-line react-hooks/set-state-in-effect -- Es el punto: el primer render tiene que ser idéntico al del build, y sólo después de montar se puede mirar el navegador.
  useEffect(() => { setUrl(waUrl({ mobile: movil, desktop: escritorio })); }, [movil, escritorio]);

  return url;
}
