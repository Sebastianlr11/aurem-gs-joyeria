-- El esquema base: las tablas que el repositorio no sabía crear.
--
-- Hasta hoy, `supabase/migrations/` sólo tenía migraciones INCREMENTALES —añadir
-- una columna, cerrar una política— sobre tablas que nunca se crearon aquí. Se
-- habían hecho a mano en el panel de Supabase. Consecuencia: **un entorno nuevo
-- no arrancaba**. `20260311_add_shipping_address.sql` intenta un ALTER sobre
-- `orders` y `orders` no existía; `20260823_superficie_de_seguridad.sql` enciende
-- RLS sobre doce tablas que tampoco.
--
-- Por eso esta migración va fechada ANTES que todas las demás: tiene que correr
-- primero para que las incrementales encuentren su tabla. No es historia
-- revisionista, es la única forma de que la cadena se sostenga.
--
-- Está volcada del catálogo de Postgres, no escrita a mano: columnas, tipos,
-- valores por defecto, claves, únicos y CHECKs salen de `pg_attribute` y
-- `pg_get_constraintdef`. Verificado comparando el md5 de lo generado contra el
-- de la base — idénticos.
--
-- Todo es `if not exists`, así que correrla sobre la base que ya existe no toca
-- nada. Lo que NO está aquí y no hace falta: `taller_precios`,
-- `taller_conocimiento`, `plantillas_enviadas` y `pagos`, que sí tenían su
-- migración; las políticas RLS, que están en `20260823_superficie_de_seguridad`;
-- y las cuatro tablas muertas, que se borraron el 23 de agosto.
--
-- Un detalle que este volcado deja a la vista: `orders.status` admite
-- **`confirmado`**, un séptimo estado que ni el panel ni la documentación
-- mencionan. Está en el CHECK de la base desde antes; se conserva tal cual
-- porque quitarlo es otra decisión, no la de poder reconstruir.

create table if not exists public.ajustes_internos (
  clave text not null,
  valor text not null,
  nota text,
  actualizado_en timestamp with time zone not null default now(),
  constraint ajustes_internos_pkey PRIMARY KEY (clave)
);

create table if not exists public.chat_status (
  phone_number text not null,
  is_resolved boolean not null default false,
  is_archived boolean not null default false,
  resolved_at timestamp with time zone,
  archived_at timestamp with time zone,
  updated_at timestamp with time zone default now(),
  constraint chat_status_pkey PRIMARY KEY (phone_number)
);

create table if not exists public.chat_takeover (
  id uuid not null default gen_random_uuid(),
  phone_number text not null,
  is_active boolean default true,
  admin_email text,
  started_at timestamp with time zone default now(),
  ended_at timestamp with time zone,
  reason text,
  constraint unique_phone_number UNIQUE (phone_number),
  constraint chat_takeover_pkey PRIMARY KEY (id)
);

create table if not exists public.contact_tags (
  id uuid not null default gen_random_uuid(),
  phone_number text not null,
  tag_name text not null,
  color text not null default '#D4AF37'::text,
  created_at timestamp with time zone default now(),
  constraint contact_tags_phone_number_tag_name_key UNIQUE (phone_number, tag_name),
  constraint contact_tags_pkey PRIMARY KEY (id)
);

create table if not exists public.customers (
  id uuid not null default gen_random_uuid(),
  name text default ''::text,
  phone text,
  email text,
  notes text,
  created_at timestamp with time zone not null default now(),
  city text,
  address text,
  department text,
  updated_at timestamp with time zone default now(),
  no_escribir boolean not null default false,
  es_prueba boolean not null default false,
  constraint customers_phone_unique UNIQUE (phone),
  constraint customers_pkey PRIMARY KEY (id)
);

create table if not exists public.gasto_pauta (
  id uuid not null default gen_random_uuid(),
  fecha date not null,
  canal text not null,
  monto numeric(12,2) not null,
  nota text,
  creado_en timestamp with time zone not null default now(),
  constraint gasto_pauta_fecha_canal_key UNIQUE (fecha, canal),
  constraint gasto_pauta_pkey PRIMARY KEY (id),
  constraint gasto_pauta_canal_check CHECK ((canal = ANY (ARRAY['meta'::text, 'tiktok'::text, 'otro'::text]))),
  constraint gasto_pauta_monto_check CHECK ((monto >= (0)::numeric))
);

create table if not exists public.notes (
  id uuid not null default gen_random_uuid(),
  title text not null,
  content text not null default ''::text,
  priority text not null default 'normal'::text,
  is_completed boolean not null default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint notes_pkey PRIMARY KEY (id),
  constraint notes_priority_check CHECK ((priority = ANY (ARRAY['baja'::text, 'normal'::text, 'alta'::text, 'urgente'::text])))
);

create table if not exists public.order_items (
  id uuid not null default gen_random_uuid(),
  order_id uuid not null,
  product_id uuid,
  nombre text not null,
  precio numeric not null,
  cantidad integer not null default 1,
  talla text,
  creado_en timestamp with time zone not null default now(),
  constraint order_items_pkey PRIMARY KEY (id),
  constraint order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  constraint order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  constraint order_items_cantidad_check CHECK ((cantidad > 0)),
  constraint order_items_precio_check CHECK ((precio >= (0)::numeric))
);

create table if not exists public.orders (
  id uuid not null default gen_random_uuid(),
  customer_name text not null,
  customer_phone text,
  product_id uuid,
  product_name text not null,
  amount numeric(12,2) not null default 0,
  status text not null default 'pendiente'::text,
  notes text,
  created_at timestamp with time zone not null default now(),
  customer_email text,
  mp_preference_id text,
  mp_payment_id text,
  mp_status text,
  payment_method text not null default 'mercadopago'::text,
  shipping_address text,
  shipping_city text,
  shipping_department text,
  order_source text default 'web'::text,
  carrier text,
  tracking_number text,
  status_updated_at timestamp with time zone,
  ttclid text,
  ttp text,
  fbc text,
  fbp text,
  conversion_enviada_en timestamp with time zone,
  client_ua text,
  client_ip text,
  ctwa_clid text,
  anuncio_id text,
  utm_source text,
  utm_campaign text,
  abono_monto numeric,
  abono_pagado_en timestamp with time zone,
  es_prueba boolean not null default false,
  cancelacion_enviada_en timestamp with time zone,
  costo_taller numeric,
  costo_envio numeric,
  costo_anotado_en timestamp with time zone,
  constraint orders_pkey PRIMARY KEY (id),
  constraint orders_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  constraint orders_payment_method_check CHECK (((payment_method IS NULL) OR (payment_method = ANY (ARRAY['mercadopago'::text, 'contraentrega'::text, 'nequi'::text, 'daviplata'::text, 'transferencia'::text, 'efectivo'::text])))),
  constraint orders_status_check CHECK ((status = ANY (ARRAY['pendiente'::text, 'pagado'::text, 'procesando'::text, 'confirmado'::text, 'enviado'::text, 'entregado'::text, 'cancelado'::text])))
);

create table if not exists public.products (
  id uuid not null default gen_random_uuid(),
  name text not null,
  category text not null,
  price numeric(10,2) not null default 0,
  description text,
  image_url text,
  is_new boolean not null default false,
  is_featured boolean not null default false,
  created_at timestamp with time zone not null default now(),
  images text[] not null default '{}'::text[],
  compare_price numeric,
  stock integer,
  metal text,
  piedra text,
  engaste text,
  talla_rango text,
  costo numeric(12,2),
  costo_provisional boolean not null default false,
  constraint products_pkey PRIMARY KEY (id),
  constraint products_category_check CHECK ((category = ANY (ARRAY['Anillos'::text, 'Collares'::text, 'Aretes'::text, 'Pulseras'::text, 'Dijes'::text]))),
  constraint products_stock_no_negativo CHECK (((stock IS NULL) OR (stock >= 0)))
);

create table if not exists public.vigilancia_ultima (
  id integer not null default 1,
  corrida_en timestamp with time zone not null default now(),
  hallazgos jsonb not null default '[]'::jsonb,
  constraint vigilancia_ultima_pkey PRIMARY KEY (id),
  constraint vigilancia_ultima_id_check CHECK ((id = 1))
);

create table if not exists public.whatsapp_conversaciones (
  id uuid not null default gen_random_uuid(),
  phone_number text not null,
  role text not null,
  content text not null,
  created_at timestamp with time zone not null default now(),
  message_type text default 'text'::text,
  media_url text,
  is_read boolean default false,
  delivery_status text default 'sent'::text,
  enviado_por text,
  wa_message_id text,
  wa_phone_id text,
  referral jsonb,
  error_wa jsonb,
  constraint whatsapp_conversaciones_pkey PRIMARY KEY (id),
  constraint whatsapp_conversaciones_delivery_status_check CHECK ((delivery_status = ANY (ARRAY['sent'::text, 'delivered'::text, 'read'::text, 'failed'::text]))),
  constraint whatsapp_conversaciones_enviado_por_check CHECK (((enviado_por IS NULL) OR (enviado_por = ANY (ARRAY['ia'::text, 'humano'::text])))),
  constraint whatsapp_conversaciones_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text])))
);

-- ── Índices ─────────────────────────────────────────────────────────
-- Los que sostienen consultas del panel y del bot. Los que respaldan claves y
-- únicos ya vienen con la tabla.

create index if not exists idx_chat_status_archived ON public.chat_status USING btree (is_archived);
create index if not exists idx_chat_status_resolved ON public.chat_status USING btree (is_resolved);
create index if not exists idx_takeover_active ON public.chat_takeover USING btree (phone_number) WHERE (is_active = true);
create index if not exists idx_contact_tags_phone ON public.contact_tags USING btree (phone_number);
create index if not exists gasto_pauta_fecha_idx ON public.gasto_pauta USING btree (fecha DESC);
create index if not exists order_items_pedido_idx ON public.order_items USING btree (order_id);
create index if not exists idx_orders_created ON public.orders USING btree (created_at DESC);
create index if not exists idx_orders_customer_phone_created ON public.orders USING btree (customer_phone, created_at);
create index if not exists idx_orders_shipping_city ON public.orders USING btree (shipping_city) WHERE (shipping_city IS NOT NULL);
create index if not exists idx_orders_source_created ON public.orders USING btree (order_source, created_at);
create index if not exists orders_atribucion_idx ON public.orders USING btree (created_at DESC) WHERE (status = ANY (ARRAY['pagado'::text, 'procesando'::text, 'enviado'::text, 'entregado'::text]));
create index if not exists idx_products_category ON public.products USING btree (category);
create index if not exists idx_wa_conv_phone ON public.whatsapp_conversaciones USING btree (phone_number, created_at DESC);
create index if not exists idx_wa_conv_phone_id ON public.whatsapp_conversaciones USING btree (phone_number, created_at DESC) WHERE (wa_phone_id IS NOT NULL);
create index if not exists idx_wa_conv_phone_role_created ON public.whatsapp_conversaciones USING btree (phone_number, role, created_at);
create index if not exists idx_wa_conv_referral ON public.whatsapp_conversaciones USING btree (phone_number, created_at) WHERE (referral IS NOT NULL);

-- ESTE es el candado anti-reentrega de WhatsApp, y es un índice único parcial,
-- no una restricción: Meta reenvía el mismo mensaje cuando no recibe el 200 a
-- tiempo, y sin esto Valentina respondía dos veces a lo mismo. Parcial porque
-- los mensajes que salen de nosotros no siempre traen wamid.
create unique index if not exists whatsapp_conversaciones_wa_message_id_idx ON public.whatsapp_conversaciones USING btree (wa_message_id) WHERE (wa_message_id IS NOT NULL);

-- ── La vista pública del envío ──────────────────────────────────────
-- Existe para no filtrar el margen: `taller_precios` guarda también el recargo
-- del taller, y el frontend sólo puede ver estas dos columnas.

create or replace view public.envio_publico as
 SELECT abono_envio,
    tope_contraentrega
   FROM taller_precios
 LIMIT 1;
