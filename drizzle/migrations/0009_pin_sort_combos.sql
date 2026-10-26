ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS sort int NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS products_pinned_idx ON public.products(pinned DESC, created_at DESC);
UPDATE public.categories c SET sort = s.rn FROM (SELECT id, row_number() OVER (ORDER BY created_at) AS rn FROM public.categories) s WHERE s.id = c.id;

CREATE OR REPLACE FUNCTION public.seed_model_catalog(_cat text, _n int, _photos jsonb)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  made int := 0; cat text; style text; nm text; cols jsonb; imgs jsonb; sizes text[]; mrp numeric; disc int; pid uuid; k int; pack int; badge text := '';
  cats text[] := array['bra','panty','girls','starter','combo','nightwear','set','shapewear','activewear'];
  palette jsonb := '[{"name":"Sindoor Red","hex":"#C41E3A"},{"name":"Rani Pink","hex":"#E75480"},{"name":"Wine Maroon","hex":"#722F37"},{"name":"Nude/Skin","hex":"#E8BEAC"},{"name":"Jet Black","hex":"#1A1A1A"},{"name":"Peacock Blue","hex":"#005A9C"},{"name":"Emerald Green","hex":"#046307"},{"name":"Pure White","hex":"#FFFFFF"},{"name":"Royal Navy","hex":"#002366"}]';
  adj text[] := array['Desi','Rani','Mehak','Shringar','Kesar','Chandni','Gulab','Noor','Sitara','Anaya','Zoya','Riya'];
  styles jsonb := '{"bra":["T-Shirt Bra","Padded Bra","Wireless Bra","Balconette Bra","Plunge Bra","Everyday Cotton Bra"],
    "panty":["Hipster Panty","Bikini Panty","High-Waist Panty","Seamless No-Show Panty","Boyshorts","Lace Panty","Tummy Control High-Rise Panty","Cotton Brief","Thong Panty","Cheeky Panty","Period Panty","Maternity Panty"],
    "girls":["Girls Cotton Hipster Panty","Teen Bikini Panty","Girls Boyshort Panty","Teen Seamless Panty","Girls Printed Brief","Teen Anti-Chafing Shorts"],
    "starter":["Soft Slip-On Dailywear Bra","Cotton Camisole","Wire-Free Starter Bra","Teen Training Bra"],
    "combo":["Cotton Hipster Panty","Bikini Panty","Seamless Panty","Boyshorts","Everyday Cotton Bra","T-Shirt Bra"],
    "nightwear":["Satin Babydoll","Cotton Nighty","2-Piece Lounge Set"],
    "set":["Coordinated Bra & Panty Set","Lace Bridal Set"],
    "shapewear":["Tummy Tucker","Saree Silhouette Shaper"],
    "activewear":["Padded High-Impact Gym Top","Sports Tights"]}';
  bra_sizes text[] := array['30B','32B','32C','34B','34C','34D','36B','36C','36D','38B','38C','38D','40C','40D','42C','42D'];
  free_sizes text[] := array['XS','S','M','L','XL','2XL','3XL','4XL'];
  starter_sizes text[] := array['28A','30A','32A','34A','XS','S','M'];
  girl_sizes text[] := array['8-10Y','10-12Y','12-14Y','14-16Y','XS','S','M'];
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Only the store admin can do this'; END IF;
  _n := least(greatest(coalesce(_n,1),1),250);
  INSERT INTO categories(id,label,slug,sort) VALUES ('starter','Starter & Beginners','starter',90),('girls','Girls & Teen Panties','girls',91),('combo','Combo Packs (3/4/5 Set)','combo',92) ON CONFLICT (id) DO NOTHING;
  WHILE made < _n LOOP
    cat := CASE WHEN _cat = 'all' OR _cat IS NULL THEN cats[1+floor(random()*9)::int] ELSE _cat END;
    imgs := coalesce(_photos->cat, _photos->'panty', '[]'::jsonb);
    IF jsonb_array_length(imgs) = 0 THEN RAISE EXCEPTION 'No photos for category %', cat; END IF;
    style := (styles->cat)->>floor(random()*jsonb_array_length(styles->cat))::int;
    IF style IS NULL THEN RAISE EXCEPTION 'Unknown category %', cat; END IF;
    mrp := (array[699,899,999,1199,1299,1499,1799,1999])[1+floor(random()*8)::int];
    badge := '';
    IF cat = 'combo' THEN
      pack := (array[3,4,5])[1+floor(random()*3)::int];
      nm := adj[1+floor(random()*12)::int] || ' ' || style || ' - Pack of ' || pack;
      mrp := (CASE WHEN style LIKE '%Bra%' THEN 499 ELSE 299 END) * pack;
      badge := 'Pack of ' || pack;
    ELSE
      nm := adj[1+floor(random()*12)::int] || ' ' || style;
    END IF;
    sizes := CASE WHEN cat = 'girls' THEN girl_sizes WHEN cat = 'starter' THEN starter_sizes WHEN cat = 'bra' OR style LIKE '%Bra%' OR (cat = 'activewear' AND style LIKE '%Top%') THEN bra_sizes ELSE free_sizes END;
    k := 7 + floor(random()*3)::int;
    SELECT jsonb_agg(c || jsonb_build_object('images', imgs) ORDER BY o) INTO cols
      FROM jsonb_array_elements(palette) WITH ORDINALITY t(c,o) WHERE o <= k;
    disc := (array[30,35,40,45,50,55])[1+floor(random()*6)::int];
    INSERT INTO products(name,brand,category,price,old_price,description,highlights,specs,sizes,colors,images,source_url,slug,featured,is_bestseller,badge)
    VALUES (nm,'Glamour Boutique',cat,greatest(1,round(mrp*(100-disc)/100.0)),mrp,
      'Soft, breathable ' || lower(style) || CASE WHEN cat='combo' THEN ' value combo — mixed colours in one pack.' ELSE ' made for Indian weather — all-day comfort, smooth under kurtis and sarees.' END,
      array['Breathable fabric','Skin-friendly','Discreet packaging'],
      jsonb_build_object('Style',style,'Wash care','Hand wash cold, dry in shade'),
      sizes, cols, array(SELECT jsonb_array_elements_text(imgs)), 'model-seed',
      lower(regexp_replace(nm,'[^a-zA-Z0-9]+','-','g')) || '-' || substr(md5(random()::text),1,8),
      random() < 0.08, random() < 0.15, badge)
    RETURNING id INTO pid;
    INSERT INTO product_variants(product_id,color_name,color_hex,available_sizes,model_photos,sort)
    SELECT pid, c->>'name', c->>'hex', sizes, array(SELECT jsonb_array_elements_text(imgs)), o::int-1
      FROM jsonb_array_elements(cols) WITH ORDINALITY t(c,o);
    made := made + 1;
  END LOOP;
  RETURN made;
END $$;
REVOKE ALL ON FUNCTION public.seed_model_catalog(text,int,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_model_catalog(text,int,jsonb) TO authenticated;