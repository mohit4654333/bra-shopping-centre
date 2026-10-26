CREATE INDEX IF NOT EXISTS products_created_idx ON public.products(created_at DESC);

CREATE OR REPLACE FUNCTION public.seed_model_catalog(_cat text, _n int, _photos jsonb)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  made int := 0; cat text; style text; nm text; cols jsonb; imgs jsonb; sizes text[]; mrp numeric; disc int; pid uuid; k int;
  cats text[] := array['bra','panty','starter','nightwear','set','shapewear','activewear'];
  palette jsonb := '[{"name":"Sindoor Red","hex":"#C41E3A"},{"name":"Rani Pink","hex":"#E75480"},{"name":"Wine Maroon","hex":"#722F37"},{"name":"Nude/Skin","hex":"#E8BEAC"},{"name":"Jet Black","hex":"#1A1A1A"},{"name":"Peacock Blue","hex":"#005A9C"},{"name":"Emerald Green","hex":"#046307"},{"name":"Pure White","hex":"#FFFFFF"},{"name":"Royal Navy","hex":"#002366"}]';
  adj text[] := array['Desi','Rani','Mehak','Shringar','Kesar','Chandni','Gulab','Noor','Sitara','Anaya','Zoya','Riya'];
  styles jsonb := '{"bra":["T-Shirt Bra","Padded Bra","Wireless Bra","Balconette Bra","Plunge Bra","Everyday Cotton Bra"],
    "panty":["Hipster Panty","Bikini Panty","High-Waist Panty","Seamless Panty","Boyshorts"],
    "starter":["Soft Slip-On Dailywear Bra","Cotton Camisole","Wire-Free Starter Bra"],
    "nightwear":["Satin Babydoll","Cotton Nighty","2-Piece Lounge Set"],
    "set":["Coordinated Bra & Panty Set","Lace Bridal Set"],
    "shapewear":["Tummy Tucker","Saree Silhouette Shaper"],
    "activewear":["Padded High-Impact Gym Top","Sports Tights"]}';
  bra_sizes text[] := array['30B','32B','32C','34B','34C','34D','36B','36C','36D','38B','38C','38D','40C','40D','42C','42D'];
  free_sizes text[] := array['XS','S','M','L','XL','2XL','3XL','4XL'];
  starter_sizes text[] := array['28A','30A','32A','34A','XS','S','M'];
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Only the store admin can do this'; END IF;
  _n := least(greatest(coalesce(_n,1),1),250);
  INSERT INTO categories(id,label,slug) VALUES ('starter','Starter & Beginners','starter') ON CONFLICT (id) DO NOTHING;
  WHILE made < _n LOOP
    cat := CASE WHEN _cat = 'all' OR _cat IS NULL THEN cats[1+floor(random()*7)::int] ELSE _cat END;
    imgs := coalesce(_photos->cat, '[]'::jsonb);
    IF jsonb_array_length(imgs) = 0 THEN RAISE EXCEPTION 'No photos for category %', cat; END IF;
    style := (styles->cat)->>floor(random()*jsonb_array_length(styles->cat))::int;
    IF style IS NULL THEN RAISE EXCEPTION 'Unknown category %', cat; END IF;
    nm := adj[1+floor(random()*12)::int] || ' ' || style;
    sizes := CASE WHEN cat = 'starter' THEN starter_sizes WHEN cat = 'bra' OR (cat = 'activewear' AND style LIKE '%Top%') THEN bra_sizes ELSE free_sizes END;
    k := 7 + floor(random()*3)::int;
    SELECT jsonb_agg(c || jsonb_build_object('images', imgs) ORDER BY o) INTO cols
      FROM jsonb_array_elements(palette) WITH ORDINALITY t(c,o) WHERE o <= k;
    mrp := (array[699,899,999,1199,1299,1499,1799,1999])[1+floor(random()*8)::int];
    disc := (array[30,35,40,45,50,55])[1+floor(random()*6)::int];
    INSERT INTO products(name,brand,category,price,old_price,description,highlights,specs,sizes,colors,images,source_url,slug,featured,is_bestseller)
    VALUES (nm,'Glamour Boutique',cat,greatest(1,round(mrp*(100-disc)/100.0)),mrp,
      'Soft, breathable ' || lower(style) || ' made for Indian weather — all-day comfort, smooth under kurtis and sarees.',
      array['Breathable fabric','Skin-friendly','Discreet packaging'],
      jsonb_build_object('Style',style,'Wash care','Hand wash cold, dry in shade'),
      sizes, cols, array(SELECT jsonb_array_elements_text(imgs)), 'model-seed',
      lower(regexp_replace(nm,'[^a-zA-Z0-9]+','-','g')) || '-' || substr(md5(random()::text),1,8),
      random() < 0.08, random() < 0.15)
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