import { origenCorto } from './atribucion';

export const WA_NUMBER = '573115761896';

export const isMobile = () =>
  /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(
    navigator.userAgent
  );

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

  return `https://wa.me/${WA_NUMBER}?text=${encodeWA(text)}`;
};
