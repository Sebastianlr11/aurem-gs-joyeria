-- ============================================================
-- GALA JOYERÍA — Supabase Schema
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Tabla de productos
CREATE TABLE IF NOT EXISTS public.products (
  id          uuid             DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text             NOT NULL,
  category    text             NOT NULL CHECK (category IN ('Anillos', 'Collares', 'Aretes', 'Pulseras')),
  price       numeric(10, 2)   NOT NULL DEFAULT 0,
  description text,
  image_url   text,
  is_new      boolean          NOT NULL DEFAULT false,
  is_featured boolean          NOT NULL DEFAULT false,
  created_at  timestamptz      NOT NULL DEFAULT now()
);

-- 2. Habilitar RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 3. Lectura pública (catálogo)
CREATE POLICY "products_public_read"
  ON public.products
  FOR SELECT
  USING (true);

-- 4. CRUD solo para usuarios autenticados (admin)
CREATE POLICY "products_auth_insert"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "products_auth_update"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "products_auth_delete"
  ON public.products
  FOR DELETE
  TO authenticated
  USING (true);

-- 5. (Opcional) Índice por categoría para filtrado rápido
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products (category);

-- ============================================================
-- STORAGE (ejecutar en Storage > New bucket si no existe)
-- Bucket name: product-images  |  Public: true
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('product-images', 'product-images', true)
-- ON CONFLICT DO NOTHING;
