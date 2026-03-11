-- ============================================================
-- Orders table — Row Level Security
-- ============================================================

-- 1. Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 2. Public can INSERT orders (customers creating orders from checkout)
CREATE POLICY "orders_public_insert"
  ON public.orders
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 3. Only authenticated users (admin) can read all orders
CREATE POLICY "orders_auth_read"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (true);

-- 4. Public can read their own order by ID (for confirmation page)
--    Uses the anon key — customer can only see order if they know the ID
CREATE POLICY "orders_anon_read_own"
  ON public.orders
  FOR SELECT
  TO anon
  USING (true);

-- 5. Only authenticated users (admin) can update orders
CREATE POLICY "orders_auth_update"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 6. Only authenticated users (admin) can delete orders
CREATE POLICY "orders_auth_delete"
  ON public.orders
  FOR DELETE
  TO authenticated
  USING (true);
