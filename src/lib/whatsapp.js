export const WA_NUMBER = '573143602930';

/**
 * Codifica el texto para URLs de WhatsApp.
 * Deja los emojis (code points > U+FFFF) sin codificar
 * para que lleguen correctamente a WhatsApp.
 */
export const encodeWA = (text) =>
  [...text]
    .map((char) => {
      const cp = char.codePointAt(0);
      if (cp > 0xffff) return char; // emoji — sin codificar
      return encodeURIComponent(char);
    })
    .join('');

export const waUrl = (text) =>
  `https://wa.me/${WA_NUMBER}?text=${encodeWA(text)}`;
