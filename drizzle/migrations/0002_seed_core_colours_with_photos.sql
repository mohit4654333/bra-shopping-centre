CREATE OR REPLACE FUNCTION public.seed_catalog_category(_cat text, _n integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  palette text[][] := ARRAY[['Nude / Beige','#E2BA9D','nude'],['Midnight Black','#111111','black'],['Ruby Red','#B91C1C','red'],
                            ['Pure White','#F8F8F5','white'],['Royal Navy','#1E2A4A','navy']];
  bra_sizes text[] := ARRAY['32B','32C','34B','34C','36B','36C','38B','38C','38D'];
  free_sizes text[] := ARRAY['S','M','L','XL','XXL'];
  adj text[] := ARRAY['Everyday','Seamless','Lace Trim','Cloud Soft','Silk Touch','Second Skin','Breathable','Luxe','Signature','Airy','Velvet','Contour'];
  noun text;
  fabrics text[] := ARRAY['Cotton','Cotton Spandex','Satin','Nylon Spandex','Modal','Lace'];
  is_bra boolean := _cat LIKE '%bra%';
  i int; k int; pid uuid; nm text; mrp numeric; disc int; fab text; pad text; wire text;
  sizes text[]; cols jsonb; key text; imgs jsonb;
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
    cols := '[]'::jsonb;
    FOR k IN 1..5 LOOP
      key := palette[k][3];
      imgs := jsonb_build_array('/seed/'||key||'-front.jpg','/seed/'||key||'-side.jpg','/seed/'||key||'-back.jpg','/seed/'||key||'-detail.jpg');
      cols := cols || jsonb_build_object('name', palette[k][1], 'hex', palette[k][2], 'images', imgs);
    END LOOP;
    INSERT INTO public.products (name, brand, category, price, old_price, description, highlights, specs, sizes, colors, images, source_url,
      slug, fabric_details, is_bestseller, featured)
    VALUES (nm, 'Glamour Boutique', _cat, greatest(1, round(mrp*(100-disc)/100.0)), mrp,
      'A ' || lower(fab) || ' ' || lower(noun) || ' made for all-day comfort, with a smooth finish under clothes.',
      ARRAY[fab || ' fabric', pad, wire, 'Discreet packaging'],
      jsonb_build_object('Fabric', fab, 'Padding', pad, 'Wire', wire, 'Wash care', 'Hand wash cold, dry in shade, do not bleach'),
      sizes, cols, '{}', 'seed',
      lower(regexp_replace(nm, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text), 1, 6),
      fab, random() < 0.15, random() < 0.08)
    RETURNING id INTO pid;
    INSERT INTO public.product_variants (product_id, color_name, color_hex, available_sizes, model_photos, sort)
    SELECT pid, c->>'name', c->>'hex', sizes, ARRAY(SELECT jsonb_array_elements_text(c->'images')), ord::int - 1
    FROM jsonb_array_elements(cols) WITH ORDINALITY AS t(c, ord);
  END LOOP;
  RETURN _n;
END $$;
REVOKE ALL ON FUNCTION public.seed_catalog_category(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_catalog_category(text, integer) TO authenticated;