/**
 * Las categorías del catálogo, en el orden en que se enseñan.
 *
 * Estaba escrita cuatro veces —el riel del catálogo, el formulario del panel,
 * el filtro de Productos y el formulario de contacto— y las cuatro copias
 * habían dejado de decir lo mismo: el contacto ofrecía cuatro categorías de
 * las siete, así que quien buscaba unos aretes o un dije marcaba
 * «personalizado» o no marcaba nada. Ahora hay una sola lista.
 *
 * **`products.category` sí tiene `CHECK`** —al revés que `orders.status`—, así
 * que añadir una categoría aquí sin migración deja el panel escogiéndola y la
 * base rechazando el guardado. Ver `20260830_topos_y_juegos.sql`.
 */
export const CATEGORIAS = [
  'Anillos',
  'Collares',
  'Aretes',
  'Topos',
  'Pulseras',
  'Dijes',
  'Juegos',
]
