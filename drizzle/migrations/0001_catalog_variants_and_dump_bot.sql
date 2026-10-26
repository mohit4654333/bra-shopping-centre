ALTER TABLE public.categories
  ADD COLUMN slug text,
  ADD COLUMN image_url text NOT NULL DEFAULT '',
  ADD COLUMN is_active boolean NOT NULL DEFAULT true;
UPDATE public.categories SET slug = id WHERE slug IS NULL;
ALTER TABLE public.categories ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX categories_slug_key ON public.categories(slug);

ALTER TABLE public.products
  ADD COLUMN slug text,
  ADD COLUMN fabric_details text NOT NULL DEFAULT '',
  ADD COLUMN is_bestseller boolean NOT NULL DEFAULT false,
  ADD COLUMN is_active boolean NOT NULL DEFAULT true;
CREATE UNIQUE INDEX products_slug_key ON public.products(slug);
CREATE INDEX products_category_idx ON public.products(category);

CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  color_name text NOT NULL,
  color_hex text NOT NULL DEFAULT '#cccccc',
  available_sizes text[] NOT NULL DEFAULT '{}',
  model_photos text[] NOT NULL DEFAULT '{}',
  sort int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_variants_product_idx ON public.product_variants(product_id, sort);
GRANT SELECT ON public.product_variants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT ALL ON public.product_variants TO service_role;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view variants" ON public.product_variants FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins insert variants" ON public.product_variants FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update variants" ON public.product_variants FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete variants" ON public.product_variants FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Holds API keys, so admin-only (never public).
CREATE TABLE public.admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upi_id text NOT NULL DEFAULT '',
  qr_image_url text NOT NULL DEFAULT '',
  api_keys jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_settings TO authenticated;
GRANT ALL ON public.admin_settings TO service_role;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage admin settings" ON public.admin_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.admin_settings (upi_id) VALUES ('');

-- Standard lingerie categories (idempotent).
CREATE OR REPLACE FUNCTION public.seed_categories()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Only the store admin can do this'; END IF;
  INSERT INTO public.categories (id, label, slug, is_active, created_at)
  SELECT v.id, v.label, v.id, true, now() + (v.ord || ' second')::interval
  FROM (VALUES
    ('t-shirt-bras','T-Shirt Bras',10),('padded-bras','Padded Bras',11),('push-up-bras','Push-Up Bras',12),
    ('sports-bras','Sports Bras',13),('panties','Panties',14),('nightwear','Nightwear',15),
    ('shapewear','Shapewear',16),('lingerie-sets','Lingerie Sets',17)) v(id,label,ord)
  ON CONFLICT (id) DO UPDATE SET is_active = true;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.seed_categories() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_categories() TO authenticated;

-- Generates _n products (with 3-4 colour variants each) for one category, entirely in the database.
CREATE OR REPLACE FUNCTION public.seed_catalog_category(_cat text, _n integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  palette text[][] := ARRAY[['Jet Black','#111111'],['Nude Beige','#E2BA9D'],['Ruby Red','#B91C1C'],['Pure White','#F8F8F5'],
                            ['Blush Pink','#F4B6C2'],['Navy Blue','#1E2A4A'],['Wine','#6B1E35'],['Lilac','#C8A2C8']];
  bra_sizes text[] := ARRAY['32B','34B','34C','36B','36C','38C','38D'];
  free_sizes text[] := ARRAY['S','M','L','XL','XXL'];
  adj text[] := ARRAY['Everyday','Seamless','Lace Trim','Cloud Soft','Silk Touch','Second Skin','Breathable','Luxe','Signature','Airy','Velvet','Contour'];
  noun text;
  fabrics text[] := ARRAY['Cotton','Cotton Spandex','Satin','Nylon Spandex','Modal','Lace'];
  is_bra boolean := _cat LIKE '%bra%';
  i int; k int; nc int; pid uuid; nm text; mrp numeric; disc int; fab text; pad text; wire text;
  sizes text[]; cols jsonb; start int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Only the store admin can do this'; END IF;
  IF _n IS NULL OR _n < 1 OR _n > 300 THEN RAISE EXCEPTION 'Count must be 1-300'; END IF;
  noun := CASE _cat WHEN 't-shirt-bras' THEN 'T-Shirt Bra' WHEN 'padded-bras' THEN 'Padded Bra' WHEN 'push-up-bras' THEN 'Push-Up Bra'
    WHEN 'sports-bras' THEN 'Sports Bra' WHEN 'panties' THEN 'Hipster Panty' WHEN 'nightwear' THEN 'Night Set'
    WHEN 'shapewear' THEN 'Shaper' WHEN 'lingerie-sets' THEN 'Bra & Panty Set' ELSE 'Essential' END;
  sizes := CASE WHEN is_bra OR _cat = 'lingerie-sets' THEN bra_sizes ELSE free_sizes END;
  FOR i IN 1.._n LOOP
    nm := adj[1 + floor(random()*array_length(adj,1))::int] || ' ' || noun;
    mrp := (ARRAY[799,999,1199,1299,1499,1799,1999,2499])[1 + floor(random()*8)::int];
    disc := (ARRAY[30,35,40,45,50,55,60])[1 + floor(random()*7)::int];
    fab := fabrics[1 + floor(random()*array_length(fabrics,1))::int];
    pad := CASE WHEN _cat IN ('padded-bras','push-up-bras') THEN 'Padded' WHEN is_bra THEN (ARRAY['Padded','Non-Padded'])[1+floor(random()*2)::int] ELSE 'Non-Padded' END;
    wire := CASE WHEN _cat = 'push-up-bras' THEN 'Wired' WHEN is_bra THEN (ARRAY['Wired','Wirefree'])[1+floor(random()*2)::int] ELSE 'Wirefree' END;
    nc := 3 + floor(random()*2)::int;
    start := floor(random()*8)::int;
    cols := '[]'::jsonb;
    FOR k IN 0..nc-1 LOOP
      cols := cols || jsonb_build_object('name', palette[1 + ((start+k) % 8)][1], 'hex', palette[1 + ((start+k) % 8)][2], 'images', '[]'::jsonb);
    END LOOP;
    INSERT INTO public.products (name, brand, category, price, old_price, description, highlights, specs, sizes, colors, source_url,
      slug, fabric_details, is_bestseller, featured)
    VALUES (nm, 'Glamour Boutique', _cat, greatest(1, round(mrp*(100-disc)/100.0)), mrp,
      'A ' || lower(fab) || ' ' || lower(noun) || ' made for all-day comfort, with a smooth finish under clothes.',
      ARRAY[fab || ' fabric', pad, wire, 'Discreet packaging'],
      jsonb_build_object('Fabric', fab, 'Padding', pad, 'Wire', wire, 'Wash care', 'Hand wash cold, dry in shade, do not bleach'),
      sizes, cols, 'seed',
      lower(regexp_replace(nm, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text), 1, 6),
      fab, random() < 0.15, random() < 0.08)
    RETURNING id INTO pid;
    INSERT INTO public.product_variants (product_id, color_name, color_hex, available_sizes, model_photos, sort)
    SELECT pid, c->>'name', c->>'hex', sizes, '{}', ord::int - 1
    FROM jsonb_array_elements(cols) WITH ORDINALITY AS t(c, ord);
  END LOOP;
  RETURN _n;
END $$;
REVOKE ALL ON FUNCTION public.seed_catalog_category(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_catalog_category(text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.clear_catalog()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Only the store admin can do this'; END IF;
  DELETE FROM public.product_variants WHERE true;
  DELETE FROM public.products WHERE true;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.clear_catalog() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_catalog() TO authenticated;