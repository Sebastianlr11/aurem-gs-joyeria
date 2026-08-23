/**
 * Lo que comparten las secciones del panel.
 *
 * Vivían sueltas en Dashboard.jsx, que pasaba de las 4.400 líneas. Al empezar
 * a sacar cada sección a su archivo hacía falta un sitio para lo que usan
 * todas: aquí no hay lógica de pantalla, sólo formato y comparaciones.
 */

export const fmt = n => Number(n || 0).toLocaleString('es-CO');

export const fmtDate = d => new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });

/* Sin tildes y en minúsculas, para buscar sin que "Bogotá" y "bogota" sean
   cosas distintas. */
export const norm = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
