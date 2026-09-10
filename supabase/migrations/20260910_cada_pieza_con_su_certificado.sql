-- ============================================================================
-- CADA PIEZA CON SU CERTIFICADO
-- ============================================================================
-- 9 de septiembre de 2026.
--
-- Una clienta pidió un certificado de su compra. La respuesta corta es que no
-- teníamos ninguno; la larga es que hacía falta desde antes de que lo pidieran,
-- porque el obstáculo de este negocio no es el precio: es que alguien le
-- transfiera $800.000 a una joyería que encontró en un anuncio. Un documento
-- verificable con la dirección del sitio es exactamente la prueba que falta —y
-- Valentina puede ofrecerlo **antes** de la venta, que es donde vale.
--
-- ── Qué certifica, que no es lo que parece ─────────────────────────────────
--
-- «Certificado» en joyería son dos cosas. El **gemológico** lo emite un
-- laboratorio y habla de la piedra; aquí sólo se saca cuando la clienta paga el
-- excedente. Éste es el **del taller**: dice que la pieza salió de aquí, cuándo,
-- en qué metal y qué respondemos por ella. Es procedencia y garantía.
--
-- La diferencia no es semántica. Una declaración del vendedor que parezca un
-- dictamen de laboratorio es publicidad engañosa ante la SIC, así que el
-- documento lo dice por su nombre. Esa frase vive en `src/lib/certificado.js`
-- (`NOTA_LEGAL`) y viaja en la página y en la tarjeta.
--
-- Y lo que el QR **no** prueba, para que nadie lo prometa: un QR se fotocopia,
-- así que esto no demuestra que la pieza que alguien tiene en la mano sea ésa.
-- Demuestra que el código existe, de qué pieza es y cuándo se vendió — y como
-- la página enseña la foto real, quien la tiene puede comparar. Prometer más
-- sería vender humo.
--
-- ── Por qué los datos van congelados en un jsonb ───────────────────────────
--
-- Mismo motivo que `order_items` congela los precios: un pedido viejo no cambia
-- de importe porque hoy suba el oro. Si el certificado leyera `products` al
-- vuelo, corregirle el metal a una pieza reescribiría hacia atrás un documento
-- que ya está impreso en la casa de alguien. Un papel que se reescribe solo no
-- es un papel.
--
-- Por eso tampoco hay llaves foráneas que manden: `order_id` es sólo el rastro
-- para el panel, y se pone en null si el pedido desaparece. El certificado
-- sobrevive a su pedido, a su pieza y a los dos.
--
-- ── El código ──────────────────────────────────────────────────────────────
--
-- `AG-` + 8 caracteres al azar, sin 0/O ni 1/I/L. **Al azar y no consecutivo**:
-- un «N.º 003» le cuenta a la clienta que es la tercera compra de la historia
-- de la joyería, y un consecutivo se adivina —bastaría cambiar el último dígito
-- para pasearse por los certificados de los demás—. Lo genera
-- `nuevoCodigo()`; la unicidad la impone esta llave primaria, y quien inserta
-- reintenta si choca.
-- ============================================================================

-- ── El peso, que es el dato que le da peso al documento ─────────────────────
-- En un certificado de joyería el gramaje es lo más creíble que hay: es lo
-- único que se puede volver a comprobar con una balanza. No estaba en la base
-- porque hasta ahora nadie lo necesitaba; lo llena el taller pieza por pieza,
-- y ahí está el costo real de esta idea — no en el código.
--
-- Nulo significa «no se ha pesado», y entonces la línea sencillamente no sale
-- en el certificado. Una línea en blanco en un documento así lo desmiente.
alter table public.products
  add column if not exists peso_gramos numeric(8,2)
    constraint products_peso_positivo check (peso_gramos is null or peso_gramos > 0);

comment on column public.products.peso_gramos is
  'Peso de la pieza en gramos, según la balanza del taller. Nulo = sin pesar; el certificado omite la línea.';


-- ── Los certificados ────────────────────────────────────────────────────────
create table if not exists public.certificados (
  codigo      text primary key,
  order_id    uuid references public.orders(id) on delete set null,
  datos       jsonb not null,
  emitido_en  timestamptz not null default now(),
  emitido_por uuid references auth.users(id) on delete set null,
  -- Un contraentrega se puede caer en la puerta y la pieza vuelve al
  -- inventario. Por eso el certificado nace al marcar `entregado` y no antes —
  -- pero una devolución posterior también existe, y entonces el documento que
  -- ya circula tiene que poder desmentirse. La página pública lo dice.
  anulado_en  timestamptz,
  anulado_por text,
  -- El lente de pruebas del panel, igual que en `orders`: los ~17 pedidos de la
  -- base son del equipo y sus certificados no deberían contarse como reales.
  es_prueba   boolean not null default false,

  constraint certificados_codigo_valido
    check (codigo ~ '^AG-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$'),
  -- Un certificado sin nada que certificar no es un certificado.
  constraint certificados_datos_con_pieza
    check (jsonb_typeof(datos) = 'object' and coalesce(datos->>'pieza', '') <> '')
);

comment on table public.certificados is
  'Certificados de autenticidad emitidos. `datos` es la copia congelada de la pieza el día que se emitió: no se recalcula nunca.';

-- Para la columna del panel «¿este pedido ya tiene certificado?».
create index if not exists certificados_order_id_idx
  on public.certificados (order_id) where order_id is not null;

alter table public.certificados enable row level security;

-- Con `es_del_equipo()` y nunca con `using (true)`: la tabla lleva el nombre de
-- pila de cada clienta y qué joya compró.
create policy "certificados_equipo_todo" on public.certificados
  for all to authenticated
  using (public.es_del_equipo())
  with check (public.es_del_equipo());


-- ── Lo que ve quien escanea el QR ───────────────────────────────────────────
-- Una función y no una política, por el mismo motivo que `pedido_publico`: RLS
-- no sabe expresar «sólo si conoces el código». Si `anon` pudiera seleccionar
-- por código, podría seleccionar todo —basta con quitar el filtro— y eso es la
-- lista de las clientas con sus joyas.
--
-- Devuelve exactamente lo que la página pinta. Ni `order_id`, ni quién lo
-- emitió, ni `es_prueba`.
create or replace function public.certificado_publico(p_codigo text)
returns table (
  codigo     text,
  datos      jsonb,
  emitido_en timestamptz,
  anulado_en timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select c.codigo, c.datos, c.emitido_en, c.anulado_en
    from public.certificados c
   -- En mayúsculas: quien llega desde una tarjeta impresa teclea el código a
   -- mano, y lo va a escribir en minúscula. `normalizarCodigo()` ya lo arregla
   -- en el navegador, pero la API es pública y no puede confiar en eso.
   where c.codigo = upper(trim(p_codigo));
$$;

revoke all on function public.certificado_publico(text) from public;
grant execute on function public.certificado_publico(text) to anon, authenticated;


-- ── Dónde vive la tarjeta ───────────────────────────────────────────────────
-- La imagen que se manda por WhatsApp se guarda bajo el prefijo
-- `certificados/` del bucket `product-images`, que ya es público y ya tiene sus
-- políticas de equipo. Un bucket nuevo habría que crearlo a mano en el panel de
-- Supabase, y un paso de instalación que no está en ninguna migración es un
-- paso que el día que se levante otro entorno nadie va a recordar.
--
-- `fotosEnStorage.js` borra fotos derivando la ruta de la URL de la pieza, así
-- que nunca alcanza este prefijo. Si eso cambia, mirar aquí.
