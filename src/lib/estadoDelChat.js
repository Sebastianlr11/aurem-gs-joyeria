/**
 * En qué va una conversación.
 *
 * ── Por qué existe ───────────────────────────────────────────────────────
 *
 * El panel ya tenía «resuelto», «archivado» y etiquetas de colores. El 6 de
 * septiembre de 2026, con cuarenta chats encima, **ninguna se había usado ni
 * una sola vez**. No fue por falta de ganas: «marcar resuelta» vive detrás de
 * un menú de tres puntos, y «resuelto» tampoco dice lo que hace falta — el
 * joyero necesita separar «ya le hablé y está en proceso» de «esto terminó»,
 * y eso no cabe en un sí/no.
 *
 * Estos cinco son los pasos por los que pasa una venta de verdad en este
 * negocio, no un embudo de manual:
 *
 *   nuevo       nadie lo ha tocado. Es el de por defecto.
 *   atendiendo  alguien está hablando con esa persona ahora
 *   cotizado    se le pasó precio y está pensándolo — el que más se pierde
 *   vendido     cerró
 *   perdido     dijo que no, o se apagó
 *
 * ── Los colores ──────────────────────────────────────────────────────────
 *
 * Salen de la paleta de la marca (`DESIGN.md`), no de un semáforo genérico.
 * Y `nuevo` NO lleva color: si los cuarenta chats sin tocar se pintaran, el
 * color dejaría de significar «esto necesita algo» y la lista volvería a ser
 * una pared plana, que es el problema que vinimos a resolver.
 */

/** El orden es el del embudo, y es el que usa la lista de filtros. */
export const ESTADOS = [
  {
    id: 'nuevo',
    etiqueta: 'Nuevo',
    /* Sin color a propósito: ver arriba. */
    color: null,
    ayuda: 'Nadie lo ha tocado todavía',
  },
  {
    id: 'atendiendo',
    etiqueta: 'Atendiendo',
    color: '#A8863F',
    ayuda: 'Alguien está hablando con esta persona',
  },
  {
    id: 'cotizado',
    etiqueta: 'Cotizado',
    color: '#7A5F26',
    ayuda: 'Ya tiene precio y lo está pensando',
  },
  {
    id: 'vendido',
    etiqueta: 'Vendido',
    color: '#2F6B57',
    ayuda: 'Cerró la compra',
  },
  {
    id: 'perdido',
    etiqueta: 'Perdido',
    color: '#8C2F1E',
    ayuda: 'Dijo que no, o se apagó',
  },
];

export const ESTADO_POR_DEFECTO = 'nuevo';

/**
 * El estado de un chat, siempre uno válido.
 *
 * Un valor desconocido —una fila vieja, algo escrito a mano en la base— cae a
 * `nuevo` en vez de dejar la fila sin pintar y sin filtro, que es como se
 * pierde un chat sin que nadie note que se perdió.
 */
export function estadoDe(fila) {
  const id = fila?.estado;
  return ESTADOS.some((e) => e.id === id) ? id : ESTADO_POR_DEFECTO;
}

/** La definición completa, para pintar. Nunca devuelve `undefined`. */
export function definicionDe(fila) {
  const id = estadoDe(fila);
  return ESTADOS.find((e) => e.id === id);
}

/**
 * Los que siguen abiertos: no han terminado ni bien ni mal.
 *
 * Es lo que contesta «¿qué me falta por atender?», que es la pregunta con la
 * que el joyero abre el panel.
 */
export const SIGUE_ABIERTO = ['nuevo', 'atendiendo', 'cotizado'];

export const estaAbierto = (fila) => SIGUE_ABIERTO.includes(estadoDe(fila));
