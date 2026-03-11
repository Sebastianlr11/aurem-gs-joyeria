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
  const text = typeof msg === 'string'
    ? msg
    : isMobile() ? msg.mobile : msg.desktop;
  return `https://wa.me/${WA_NUMBER}?text=${encodeWA(text)}`;
};
