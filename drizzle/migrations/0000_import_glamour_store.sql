CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created_role AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'bra',
  price numeric NOT NULL DEFAULT 0,
  old_price numeric NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  highlights text[] NOT NULL DEFAULT '{}',
  specs jsonb NOT NULL DEFAULT '{}'::jsonb,
  badge text NOT NULL DEFAULT '',
  sizes text[] NOT NULL DEFAULT '{}',
  colors jsonb NOT NULL DEFAULT '[]'::jsonb,
  images text[] NOT NULL DEFAULT '{}',
  source_url text NOT NULL DEFAULT '',
  featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view products" ON public.products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update products" ON public.products FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete products" ON public.products FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX products_source_url_idx ON public.products(source_url);

CREATE TABLE public.categories (
  id text PRIMARY KEY,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view categories" ON public.categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins insert categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update categories" ON public.categories FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete categories" ON public.categories FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.categories (id, label, created_at) VALUES
('bra','Bras', now()),('panty','Panties', now() + interval '1 second'),('nightwear','Nightwear', now() + interval '2 second'),
('set','Lingerie Sets', now() + interval '3 second'),('shapewear','Shapewear', now() + interval '4 second'),
('activewear','Activewear', now() + interval '5 second'),('other','Other', now() + interval '6 second');

CREATE TABLE public.store_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  brand_name text NOT NULL DEFAULT 'Glamour Boutique',
  upi_id text NOT NULL DEFAULT 'paytmqr5fd3tr@ptys',
  theme text NOT NULL DEFAULT 'fashion',
  show_sizes boolean NOT NULL DEFAULT true,
  show_colors boolean NOT NULL DEFAULT true,
  buy_now boolean NOT NULL DEFAULT true,
  live_chat boolean NOT NULL DEFAULT true,
  offers_banner boolean NOT NULL DEFAULT true,
  announcement_bar boolean NOT NULL DEFAULT true,
  announcement_text text NOT NULL DEFAULT 'Free delivery above ₹999 · Discreet packaging · Easy exchange',
  tagline text NOT NULL DEFAULT 'Comfortable bras, panties and nightwear — every colour shown with its own photos.',
  upi_name text NOT NULL DEFAULT '',
  bg_image text NOT NULL DEFAULT '',
  bg_opacity integer NOT NULL DEFAULT 8,
  show_bg boolean NOT NULL DEFAULT false,
  reviews_enabled boolean NOT NULL DEFAULT true,
  social_proof_enabled boolean NOT NULL DEFAULT true,
  review_approval boolean NOT NULL DEFAULT false,
  landing_layout text NOT NULL DEFAULT 'boutique',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.store_settings TO anon, authenticated;
GRANT UPDATE ON public.store_settings TO authenticated;
GRANT ALL ON public.store_settings TO service_role;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads settings" ON public.store_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins update settings" ON public.store_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.store_settings (id) VALUES (1);

CREATE TABLE public.banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  subtitle text NOT NULL DEFAULT '',
  image text NOT NULL DEFAULT '',
  link_type text NOT NULL DEFAULT 'category',
  link_value text NOT NULL DEFAULT '',
  sort int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.banners TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.banners TO authenticated;
GRANT ALL ON public.banners TO service_role;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads banners" ON public.banners FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins insert banners" ON public.banners FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update banners" ON public.banners FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete banners" ON public.banners FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
INSERT INTO public.banners (title, subtitle, link_type, link_value, sort) VALUES
 ('Diwali Dhamaka Sale', 'Up to 50% off on everything', 'category', 'all', 1),
 ('Flat ₹200 Off', 'On orders above ₹1499', 'category', 'featured', 2),
 ('Festive Specials', 'New colours just landed', 'category', 'all', 3),
 ('Buy 2 Get 1 Free', 'Mix & match your favourites', 'category', 'featured', 4);

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  phone text NOT NULL,
  address text NOT NULL,
  pincode text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','dispatched','delivered','cancelled')),
  tracking_no text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.orders TO anon, authenticated;
GRANT SELECT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read orders" ON public.orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update orders" ON public.orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  customer_name text NOT NULL DEFAULT '',
  sender text NOT NULL DEFAULT 'customer' CHECK (sender IN ('customer','admin')),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_session_idx ON public.chat_messages(session_id, created_at);
GRANT INSERT ON public.chat_messages TO anon, authenticated;
GRANT SELECT ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers send messages" ON public.chat_messages FOR INSERT TO anon, authenticated WITH CHECK (sender = 'customer' OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins read chats" ON public.chat_messages FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION public.get_chat_thread(_session uuid)
RETURNS SETOF public.chat_messages LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.chat_messages WHERE session_id = _session ORDER BY created_at LIMIT 200
$$;
GRANT EXECUTE ON FUNCTION public.get_chat_thread(uuid) TO anon, authenticated;

CREATE TABLE public.app_secrets (name text PRIMARY KEY, value text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_secrets TO authenticated;
GRANT ALL ON public.app_secrets TO service_role;
ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage secrets" ON public.app_secrets FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone reads banner photos" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'banners');
CREATE POLICY "Admins upload banner photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'banners' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete banner photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'banners' AND public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  customer_name text NOT NULL CHECK (length(customer_name) BETWEEN 2 AND 60),
  city text NOT NULL DEFAULT '' CHECK (length(city) <= 60),
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text NOT NULL CHECK (length(body) BETWEEN 3 AND 1000),
  photos text[] NOT NULL DEFAULT '{}' CHECK (cardinality(photos) <= 3),
  is_sample boolean NOT NULL DEFAULT false,
  verified boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sample_never_verified CHECK (NOT (is_sample AND verified))
);
CREATE INDEX reviews_product_idx ON public.reviews(product_id, status, created_at DESC);
GRANT SELECT, INSERT ON public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads approved reviews" ON public.reviews FOR SELECT TO anon, authenticated USING (status = 'approved' OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Customers submit reviews" ON public.reviews FOR INSERT TO anon, authenticated
WITH CHECK (((status IN ('pending','approved')) AND is_sample = false AND verified = false) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update reviews" ON public.reviews FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete reviews" ON public.reviews FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Anyone reads review photos" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'review-photos');
CREATE POLICY "Anyone uploads review photos" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'review-photos' AND (storage.extension(name) IN ('jpg','jpeg','png','webp')));
CREATE POLICY "Admins delete review photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'review-photos' AND public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.get_recent_activity()
RETURNS TABLE (kind text, first_name text, product_name text, at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  (SELECT 'order', split_part(trim(o.customer_name),' ',1), coalesce(o.items->0->>'name',''), o.created_at
     FROM public.orders o WHERE o.status <> 'cancelled' AND o.created_at > now() - interval '3 days')
  UNION ALL
  (SELECT 'review', split_part(trim(r.customer_name),' ',1), p.name, r.created_at
     FROM public.reviews r JOIN public.products p ON p.id = r.product_id
     WHERE r.status = 'approved' AND r.is_sample = false AND r.rating = 5 AND r.created_at > now() - interval '3 days')
  ORDER BY 4 DESC LIMIT 20
$$;
GRANT EXECUTE ON FUNCTION public.get_recent_activity() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_review_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE needs_approval boolean;
BEGIN
  IF NEW.is_sample THEN
    NEW.status := 'approved';
    RETURN NEW;
  END IF;
  SELECT review_approval INTO needs_approval FROM public.store_settings WHERE id = 1;
  IF COALESCE(needs_approval, false) THEN NEW.status := 'pending'; ELSE NEW.status := 'approved'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER reviews_set_status BEFORE INSERT ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.set_review_status();

CREATE OR REPLACE FUNCTION public.create_order(_name text, _phone text, _address text, _pincode text, _items jsonb)
RETURNS TABLE(id uuid, total numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE lines jsonb; t numeric; oid uuid := gen_random_uuid();
BEGIN
  IF length(trim(_name)) < 2 OR _phone !~ '^[6-9][0-9]{9}$' OR _pincode !~ '^[0-9]{6}$' OR length(trim(_address)) < 10 THEN
    RAISE EXCEPTION 'Invalid details';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'color', left(coalesce(i->>'color',''),60), 'size', left(coalesce(i->>'size',''),30),
           'qty', greatest(1, least(50, (i->>'qty')::int)), 'price', p.price)), '[]'::jsonb),
         coalesce(sum(p.price * greatest(1, least(50, (i->>'qty')::int))), 0)
    INTO lines, t
  FROM jsonb_array_elements(_items) i JOIN public.products p ON p.id = (i->>'id')::uuid;
  IF jsonb_array_length(lines) = 0 THEN RAISE EXCEPTION 'Your bag items are no longer available'; END IF;
  INSERT INTO public.orders(id, customer_name, phone, address, pincode, items, total, status)
  VALUES (oid, left(trim(_name),80), _phone, left(trim(_address),300), _pincode, lines, t, 'pending');
  RETURN QUERY SELECT oid, t;
END $$;
GRANT EXECUTE ON FUNCTION public.create_order(text,text,text,text,jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.track_orders(_phone text, _code text)
RETURNS TABLE(id uuid, status text, total numeric, tracking_no text, created_at timestamptz, items jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, o.status, o.total, o.tracking_no, o.created_at, o.items FROM public.orders o
  WHERE o.phone = _phone AND length(_code) >= 6 AND o.id::text LIKE lower(_code) || '%'
$$;
GRANT EXECUTE ON FUNCTION public.track_orders(text,text) TO anon, authenticated;

CREATE TABLE public.import_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  category text NOT NULL DEFAULT 'bra',
  url text NOT NULL,
  last_scanned_page integer NOT NULL DEFAULT 0,
  last_sync_timestamp timestamptz,
  imported_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_channels TO authenticated;
GRANT ALL ON public.import_channels TO service_role;
ALTER TABLE public.import_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage import channels" ON public.import_channels FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS discount_percent integer
  GENERATED ALWAYS AS (
    CASE WHEN old_price > 0 AND price > 0 AND old_price > price
      THEN round(((old_price - price) / old_price) * 100)::integer ELSE 0 END
  ) STORED;

CREATE OR REPLACE FUNCTION public.apply_bulk_discount(_percent integer)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only the store admin can do this';
  END IF;
  IF _percent IS NULL OR _percent < 0 OR _percent > 95 THEN
    RAISE EXCEPTION 'Discount must be between 0 and 95 percent';
  END IF;
  UPDATE public.products p
     SET old_price = m.mrp,
         price = greatest(1, round(m.mrp * (100 - _percent) / 100.0))
    FROM (SELECT id, CASE WHEN old_price > 0 THEN old_price ELSE price END AS mrp FROM public.products) m
   WHERE p.id = m.id AND m.mrp > 0;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.apply_bulk_discount(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_bulk_discount(integer) TO authenticated;

CREATE TABLE public.admin_pin (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  user_id uuid NOT NULL,
  pin_hash text NOT NULL,
  salt text NOT NULL,
  fails int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_pin TO service_role;
ALTER TABLE public.admin_pin ENABLE ROW LEVEL SECURITY;