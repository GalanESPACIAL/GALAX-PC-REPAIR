-- =====================================================================
-- GALAX PC REPAIR — Backend de tienda para Supabase (Auth + RLS + RPC)
-- Idempotente. Ejecutar después de 001_schema_postgres.sql y 002_seed_postgres.sql,
-- y después del seed del catálogo (202611260002_catalog_seed.sql).
-- =====================================================================

-- 0. Columnas nuevas en profiles (Auth + roles seguros)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nombre text,
  ADD COLUMN IF NOT EXISTS apellidos text,
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 1. Tablas de tienda
CREATE TABLE IF NOT EXISTS public.store_favorites (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_code varchar(50) NOT NULL REFERENCES public.productos(codigo) ON UPDATE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_code)
);

CREATE TABLE IF NOT EXISTS public.store_cart_items (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_code varchar(50) NOT NULL REFERENCES public.productos(codigo) ON UPDATE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0 AND quantity <= 10),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_code)
);

CREATE TABLE IF NOT EXISTS public.store_orders (
  id bigserial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_email text,
  customer_phone text,
  customer_document text,
  shipping_method text,
  shipping_address text,
  shipping_city text,
  shipping_region text,
  shipping_cost numeric(10,2) NOT NULL DEFAULT 0,
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL CHECK (payment_method IN ('yape','plin','transfer','card')),
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed','refunded')),
  status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','confirmado','pagado','enviado','entregado','cancelado','rechazado')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.store_order_items (
  id bigserial PRIMARY KEY,
  order_id bigint NOT NULL REFERENCES public.store_orders(id) ON DELETE CASCADE,
  product_id integer REFERENCES public.productos(id) ON UPDATE CASCADE,
  product_code varchar(50) NOT NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(10,2) NOT NULL,
  subtotal numeric(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.store_content (
  id integer PRIMARY KEY DEFAULT 1,
  draft jsonb,
  published jsonb,
  version integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.store_content_versions (
  id bigserial PRIMARY KEY,
  version integer NOT NULL,
  note text,
  content jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.store_festive_events (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  theme text,
  effect text NOT NULL DEFAULT 'confetti',
  message text,
  cta_text text,
  cta_url text,
  colors jsonb NOT NULL DEFAULT '["#22d3ee","#8b5cf6","#ffffff"]'::jsonb,
  density integer NOT NULL DEFAULT 45 CHECK (density BETWEEN 12 AND 100),
  priority integer NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);

INSERT INTO public.store_content (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 2. Roles seguros: trigger que crea perfil y protege role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre_completo, nombre, apellidos, telefono, role)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'nombre_completo',''), NEW.email),
    NEW.raw_user_meta_data->>'nombre',
    NEW.raw_user_meta_data->>'apellidos',
    NEW.raw_user_meta_data->>'telefono',
    'customer'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.is_admin(auth.uid()) THEN
      NEW.role := 'customer';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'No autorizado para cambiar el rol del perfil.';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- is_admin se crea después de profiles.role existir (ya existe columna).
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = uid AND p.role IN ('admin','editor'));
$$;

DROP TRIGGER IF EXISTS protect_profile_role ON public.profiles;
CREATE TRIGGER protect_profile_role
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();

GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon, authenticated, service_role;

-- 3. RLS
ALTER TABLE public.store_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_content_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_festive_events ENABLE ROW LEVEL SECURITY;

-- favorites
DROP POLICY IF EXISTS "store_favorites_owner" ON public.store_favorites;
CREATE POLICY "store_favorites_owner" ON public.store_favorites
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- cart
DROP POLICY IF EXISTS "store_cart_owner" ON public.store_cart_items;
CREATE POLICY "store_cart_owner" ON public.store_cart_items
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- orders: dueño ve las suyas; admin/editor ven todas.
DROP POLICY IF EXISTS "store_orders_select_own" ON public.store_orders;
CREATE POLICY "store_orders_select_own" ON public.store_orders
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "store_orders_insert_own" ON public.store_orders;
CREATE POLICY "store_orders_insert_own" ON public.store_orders
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "store_orders_update_admin" ON public.store_orders;
CREATE POLICY "store_orders_update_admin" ON public.store_orders
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- order items: dueño/admin
DROP POLICY IF EXISTS "store_order_items_select" ON public.store_order_items;
CREATE POLICY "store_order_items_select" ON public.store_order_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.store_orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.is_admin(auth.uid()))));

DROP POLICY IF EXISTS "store_order_items_insert" ON public.store_order_items;
CREATE POLICY "store_order_items_insert" ON public.store_order_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.store_orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.is_admin(auth.uid()))));

-- content: lectura pública del publicado; escritura admin.
DROP POLICY IF EXISTS "store_content_public_select" ON public.store_content;
CREATE POLICY "store_content_public_select" ON public.store_content
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "store_content_admin_write" ON public.store_content;
CREATE POLICY "store_content_admin_write" ON public.store_content
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "store_content_versions_admin" ON public.store_content_versions;
CREATE POLICY "store_content_versions_admin" ON public.store_content_versions
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- festive: lectura pública; escritura admin.
DROP POLICY IF EXISTS "store_festive_public_select" ON public.store_festive_events;
CREATE POLICY "store_festive_public_select" ON public.store_festive_events
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "store_festive_admin_write" ON public.store_festive_events;
CREATE POLICY "store_festive_admin_write" ON public.store_festive_events
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- profiles: mejorar políticas para proteger role (trigger ya lo hace).
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id OR public.is_admin(auth.uid()))
  WITH CHECK (auth.uid() = id OR public.is_admin(auth.uid()));

-- 4. RPCs

-- Catálogo paginado en servidor.
CREATE OR REPLACE FUNCTION public.store_catalog_page(
  p_search text,
  p_category text,
  p_brands text[],
  p_min numeric,
  p_max numeric,
  p_in_stock boolean,
  p_sort text,
  p_limit integer,
  p_offset integer
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
  v_items jsonb;
  v_page integer;
  v_limit integer;
  v_offset integer;
BEGIN
  v_limit := GREATEST(1, LEAST(100, COALESCE(p_limit, 24)));
  v_offset := GREATEST(0, COALESCE(p_offset, 0));
  v_page := (v_offset / v_limit) + 1;

  SELECT count(*) INTO v_total
  FROM public.productos pr
  LEFT JOIN public.categorias ca ON ca.id = pr.categoria_id
  WHERE pr.estado = 'activo' AND pr.publicado = 1
    AND (p_search IS NULL OR p_search = '' OR
         (pr.nombre || ' ' || COALESCE(pr.marca,'') || ' ' || COALESCE(pr.modelo,'') || ' ' || pr.codigo || ' ' || COALESCE(pr.descripcion,'')) ILIKE '%' || p_search || '%')
    AND (p_category IS NULL OR p_category = '' OR ca.slug = p_category)
    AND (p_brands IS NULL OR pr.marca = ANY(p_brands))
    AND (p_min IS NULL OR pr.precio_venta >= p_min)
    AND (p_max IS NULL OR pr.precio_venta <= p_max)
    AND (NOT COALESCE(p_in_stock,false) OR pr.stock > 0);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', pr.id,
    'code', pr.codigo,
    'name', pr.nombre,
    'description', pr.descripcion,
    'model', pr.modelo,
    'brand', pr.marca,
    'category_id', pr.categoria_id,
    'category_slug', ca.slug,
    'category_name', ca.nombre,
    'price', COALESCE(pr.precio_oferta, pr.precio_venta),
    'compare_at', CASE WHEN pr.precio_oferta IS NOT NULL THEN pr.precio_venta ELSE NULL END,
    'stock', pr.stock,
    'image', pr.imagen,
    'image_kind', CASE WHEN pr.imagen ILIKE '%.svg' THEN 'referencial' ELSE 'foto' END,
    'featured', (pr.destacado = 1),
    'is_new', (pr.es_nuevo = 1),
    'published', (pr.publicado = 1),
    'specs', CASE WHEN pr.especificaciones IS NULL OR pr.especificaciones = '' THEN '{}'::jsonb ELSE pr.especificaciones::jsonb END
  ) ORDER BY
    CASE WHEN COALESCE(p_sort,'relevance') = 'price-asc' THEN pr.precio_venta END ASC NULLS LAST,
    CASE WHEN p_sort = 'price-desc' THEN pr.precio_venta END DESC NULLS LAST,
    CASE WHEN p_sort = 'name-asc' THEN pr.nombre END ASC NULLS LAST,
    CASE WHEN p_sort = 'stock-desc' THEN pr.stock END DESC NULLS LAST,
    CASE WHEN p_sort = 'newest' THEN pr.es_nuevo END DESC NULLS LAST,
    pr.destacado DESC,
    pr.stock DESC,
    pr.precio_venta ASC
  ), '[]'::jsonb) INTO v_items
  FROM (
    SELECT pr.*, ca.slug AS ca_slug, ca.nombre AS ca_nombre
    FROM public.productos pr
    LEFT JOIN public.categorias ca ON ca.id = pr.categoria_id
    WHERE pr.estado = 'activo' AND pr.publicado = 1
      AND (p_search IS NULL OR p_search = '' OR
           (pr.nombre || ' ' || COALESCE(pr.marca,'') || ' ' || COALESCE(pr.modelo,'') || ' ' || pr.codigo || ' ' || COALESCE(pr.descripcion,'')) ILIKE '%' || p_search || '%')
      AND (p_category IS NULL OR p_category = '' OR ca.slug = p_category)
      AND (p_brands IS NULL OR pr.marca = ANY(p_brands))
      AND (p_min IS NULL OR pr.precio_venta >= p_min)
      AND (p_max IS NULL OR pr.precio_venta <= p_max)
      AND (NOT COALESCE(p_in_stock,false) OR pr.stock > 0)
    ORDER BY
      CASE WHEN COALESCE(p_sort,'relevance') = 'price-asc' THEN pr.precio_venta END ASC NULLS LAST,
      CASE WHEN p_sort = 'price-desc' THEN pr.precio_venta END DESC NULLS LAST,
      CASE WHEN p_sort = 'name-asc' THEN pr.nombre END ASC NULLS LAST,
      CASE WHEN p_sort = 'stock-desc' THEN pr.stock END DESC NULLS LAST,
      CASE WHEN p_sort = 'newest' THEN pr.es_nuevo END DESC NULLS LAST,
      pr.destacado DESC,
      pr.stock DESC,
      pr.precio_venta ASC
    LIMIT v_limit OFFSET v_offset
  ) sub
  JOIN public.productos pr ON pr.id = sub.id
  LEFT JOIN public.categorias ca ON ca.id = pr.categoria_id;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'page', v_page,
    'limit', v_limit,
    'facets', jsonb_build_object('minPrice', (SELECT MIN(precio_venta) FROM public.productos WHERE estado='activo' AND publicado=1), 'maxPrice', (SELECT MAX(precio_venta) FROM public.productos WHERE estado='activo' AND publicado=1))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.store_catalog_page(text,text,text[],numeric,numeric,boolean,text,integer,integer) TO anon, authenticated;

-- Crear pedido con validación de stock/precio en servidor.
CREATE OR REPLACE FUNCTION public.store_create_order(
  p_items jsonb,
  p_customer jsonb,
  p_shipping jsonb,
  p_payment text,
  p_notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_item jsonb;
  v_product public.productos;
  v_qty integer;
  v_subtotal numeric := 0;
  v_shipping numeric := 0;
  v_total numeric;
  v_code text;
  v_order_id bigint;
  v_price numeric;
BEGIN
  IF p_payment NOT IN ('yape','plin','transfer','card') THEN
    RAISE EXCEPTION 'Método de pago no válido.';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El pedido no contiene productos.';
  END IF;

  -- Validar stock y calcular subtotal con precios del servidor.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := COALESCE((v_item->>'qty')::integer, 0);
    IF v_qty <= 0 OR v_qty > 10 THEN
      RAISE EXCEPTION 'Cantidad inválida para %.', v_item->>'code';
    END IF;
    SELECT * INTO v_product
      FROM public.productos
     WHERE codigo = v_item->>'code'
       AND estado = 'activo' AND publicado = 1
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto no disponible: %.', v_item->>'code';
    END IF;
    IF v_product.stock < v_qty THEN
      RAISE EXCEPTION 'Stock insuficiente para % (disponible: %).', v_item->>'code', v_product.stock;
    END IF;
    v_price := COALESCE(v_product.precio_oferta, v_product.precio_venta);
    v_subtotal := v_subtotal + (v_price * v_qty);
  END LOOP;

  v_shipping := CASE WHEN COALESCE(p_shipping->>'method','') = 'lima' THEN 12 ELSE 0 END;
  v_total := v_subtotal + v_shipping;

  v_code := 'GX-' || to_char(now(), 'YYYYMMDD') || '-' || lpad((floor(random() * 9000) + 1000)::text, 4, '0');

  INSERT INTO public.store_orders (
    code, user_id, customer_name, customer_email, customer_phone, customer_document,
    shipping_method, shipping_address, shipping_city, shipping_region, shipping_cost,
    subtotal, total, payment_method, payment_status, status, notes
  ) VALUES (
    v_code,
    v_user,
    COALESCE(p_customer->>'name',''),
    NULLIF(p_customer->>'email',''),
    NULLIF(p_customer->>'phone',''),
    NULLIF(p_customer->>'document',''),
    COALESCE(p_shipping->>'method',''),
    NULLIF(COALESCE(p_shipping->>'address', p_customer->>'address'),''),
    NULLIF(COALESCE(p_shipping->>'city', p_customer->>'city'),''),
    NULLIF(COALESCE(p_shipping->>'region', p_customer->>'region'),''),
    v_shipping,
    v_subtotal,
    v_total,
    p_payment,
    'pending',
    'pendiente',
    NULLIF(p_notes,'')
  )
  RETURNING id INTO v_order_id;

  -- Insertar líneas y descontar stock.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item->>'qty')::integer;
    SELECT * INTO v_product FROM public.productos WHERE codigo = v_item->>'code' FOR UPDATE;
    v_price := COALESCE(v_product.precio_oferta, v_product.precio_venta);
    INSERT INTO public.store_order_items (order_id, product_id, product_code, product_name, quantity, unit_price, subtotal)
    VALUES (v_order_id, v_product.id, v_product.codigo, v_product.nombre, v_qty, v_price, v_price * v_qty);
    UPDATE public.productos SET stock = stock - v_qty, updated_at = now() WHERE id = v_product.id;
  END LOOP;

  RETURN jsonb_build_object(
    'id', v_order_id,
    'code', v_code,
    'status', 'pendiente',
    'payment_method', p_payment,
    'subtotal', v_subtotal,
    'shipping_cost', v_shipping,
    'total', v_total,
    'created_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.store_create_order(jsonb,jsonb,jsonb,text,text) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.store_update_order_status(p_order_id bigint, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado para cambiar el estado del pedido.';
  END IF;
  IF p_status NOT IN ('pendiente','confirmado','pagado','enviado','entregado','cancelado','rechazado') THEN
    RAISE EXCEPTION 'Estado no válido.';
  END IF;
  UPDATE public.store_orders
     SET status = p_status, updated_at = now()
   WHERE id = p_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.store_update_order_status(bigint,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.store_admin_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'orders_total', (SELECT count(*) FROM public.store_orders),
    'orders_pending', (SELECT count(*) FROM public.store_orders WHERE status = 'pendiente'),
    'revenue_confirmed_pen', (SELECT COALESCE(sum(total),0) FROM public.store_orders WHERE status IN ('pagado','confirmado','entregado')),
    'products_total', (SELECT count(*) FROM public.productos),
    'products_published', (SELECT count(*) FROM public.productos WHERE estado='activo' AND publicado=1),
    'low_stock', (SELECT count(*) FROM public.productos WHERE estado='activo' AND stock <= 3)
  );
$$;

GRANT EXECUTE ON FUNCTION public.store_admin_stats() TO authenticated;

CREATE OR REPLACE FUNCTION public.store_save_draft(p_content jsonb, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_version integer;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado para guardar borradores.';
  END IF;
  INSERT INTO public.store_content (id, draft, updated_at, updated_by)
  VALUES (1, p_content, now(), auth.uid())
  ON CONFLICT (id) DO UPDATE SET draft = EXCLUDED.draft, updated_at = now(), updated_by = EXCLUDED.updated_by;
  SELECT COALESCE(max(version),0)+1 INTO v_version FROM public.store_content_versions;
  INSERT INTO public.store_content_versions (version, note, content, created_by)
  VALUES (v_version, p_note, p_content, auth.uid());
  UPDATE public.store_content SET version = v_version WHERE id = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.store_save_draft(jsonb,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.store_publish_content(p_content jsonb, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_version integer;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado para publicar contenido.';
  END IF;
  INSERT INTO public.store_content (id, draft, published, version, updated_at, updated_by)
  VALUES (1, p_content, p_content, 1, now(), auth.uid())
  ON CONFLICT (id) DO UPDATE SET draft = EXCLUDED.draft, published = EXCLUDED.published, version = public.store_content.version + 1, updated_at = now(), updated_by = EXCLUDED.updated_by;
  SELECT COALESCE(max(version),0)+1 INTO v_version FROM public.store_content_versions;
  INSERT INTO public.store_content_versions (version, note, content, created_by)
  VALUES (v_version, p_note, p_content, auth.uid());
  UPDATE public.store_content SET version = v_version WHERE id = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.store_publish_content(jsonb,text) TO authenticated;
