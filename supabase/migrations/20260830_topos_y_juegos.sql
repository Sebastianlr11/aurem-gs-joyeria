-- Dos categorías nuevas en el catálogo: «Topos» y «Juegos».
--
-- La columna `category` sí tiene restricción —al contrario que `status` en
-- `orders`—, así que sin esto el panel deja escoger la categoría y la base
-- rechaza el guardado con un 23514 que en pantalla se lee como "no se pudo
-- guardar la pieza", sin decir por qué.
--
-- «Topos» va aparte de «Aretes» aunque un topo sea un arete: es como los pide
-- la clienta y como los nombra el taller. «Juegos» son los combos —dije con
-- topos, dije con aretes—, que hasta hoy entraban donde cupieran: había tres
-- archivados en «Anillos».

alter table public.products
  drop constraint if exists products_category_check;

alter table public.products
  add constraint products_category_check
  check (category = any (array[
    'Anillos'::text,
    'Collares'::text,
    'Aretes'::text,
    'Topos'::text,
    'Pulseras'::text,
    'Dijes'::text,
    'Juegos'::text
  ]));
