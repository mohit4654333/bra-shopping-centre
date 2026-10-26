CREATE OR REPLACE FUNCTION public.clear_model_seed()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Only the store admin can do this'; END IF;
  DELETE FROM product_variants WHERE product_id IN (SELECT id FROM products WHERE source_url = 'model-seed');
  DELETE FROM products WHERE source_url = 'model-seed';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.clear_model_seed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_model_seed() TO authenticated;

CREATE OR REPLACE FUNCTION public.seed_model_catalog(_cat text, _n int, _photos jsonb)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  made int := 0; src record; cat text; style text; nm text; cols jsonb; base jsonb; pal jsonb; sizes text[]; mrp numeric; pack int; badge text; i int; pid uuid; grp text[];
  cats text[] := array['bra','panty','girls','starter','combo','nightwear','set','shapewear','activewear'];
  palette jsonb := '[{"name":"Sindoor Red","hex":"#C41E3A"},{"name":"Rani Pink","hex":"#E75480"},{"name":"Wine Maroon","hex":"#722F37"},{"name":"Nude/Skin","hex":"#E8BEAC"},{"name":"Jet Black","hex":"#1A1A1A"},{"name":"Peacock Blue","hex":"#005A9C"},{"name":"Emerald Green","hex":"#046307"},{"name":"Pure White","hex":"#FFFFFF"},{"name":"Royal Navy","hex":"#002366"}]';
  adj text[] := array['Desi','Rani','Mehak','Shringar','Kesar','Chandni','Gulab','Noor','Sitara','Anaya','Zoya','Riya'];
  styles jsonb := '{"bra":["T-Shirt Bra","Padded Bra","Wireless Bra","Balconette Bra","Plunge Bra","Everyday Cotton Bra"],
    "panty":["Hipster Panty","Bikini Panty","High-Waist Panty","Seamless No-Show Panty","Boyshorts","Lace Panty","Tummy Control High-Rise Panty","Cotton Brief","Cheeky Panty","Period Panty","Maternity Panty"],
    "girls":["Girls Cotton Hipster Panty","Teen Bikini Panty","Girls Boyshort Panty","Teen Seamless Panty","Girls Printed Brief"],
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
    style := (styles->cat)->>floor(random()*jsonb_array_length(styles->cat))::int;
    IF style IS NULL THEN RAISE EXCEPTION 'Unknown category %', cat; END IF;
    -- photo source: a real imported product (never a generated one), same type first
    grp := CASE WHEN cat IN ('bra','starter') OR style LIKE '%Bra%' THEN array['bra','starter','activewear','set']
                WHEN cat IN ('panty','girls','combo') THEN array['panty','girls','combo','set']
                ELSE array[cat] END;
    src := NULL;
    SELECT * INTO src FROM products p
      WHERE p.source_url NOT IN ('model-seed','seed') AND p.category = ANY(grp)
        AND jsonb_array_length(coalesce(p.colors,'[]'::jsonb)) > 0
        AND jsonb_array_length(coalesce(p.colors->0->'images','[]'::jsonb)) > 0
      ORDER BY random() LIMIT 1;
    IF src IS NULL THEN
      RAISE EXCEPTION 'Is category (%) ke liye store mein abhi koi real imported product nahi hai. Pehle Bulk Import se kuch products import karein — loader unhi ki real photos use karta hai.', cat;
    END IF;
    SELECT coalesce(jsonb_agg(jsonb_build_object('name',c->>'name','hex',coalesce(c->>'hex','#999999'),'images',c->'images')),'[]')
      INTO cols FROM (SELECT c FROM jsonb_array_elements(src.colors) c WHERE jsonb_array_length(coalesce(c->'images','[]'::jsonb))>0 LIMIT 9) t;
    base := cols->0->'images';
    i := 0;
    WHILE jsonb_array_length(cols) < 7 AND i < 9 LOOP
      pal := palette->i;
      IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(cols) c WHERE c->>'name' = pal->>'name') THEN
        cols := cols || jsonb_build_array(pal || jsonb_build_object('images', base));
      END IF;
      i := i + 1;
    END LOOP;
    badge := '';
    mrp := greatest(coalesce(src.old_price, src.price), src.price);
    IF cat = 'combo' THEN
      pack := (array[3,4,5])[1+floor(random()*3)::int];
      nm := adj[1+floor(random()*12)::int] || ' ' || style || ' - Pack of ' || pack;
      mrp := mrp * pack * 0.8; badge := 'Pack of ' || pack;
    ELSE
      nm := adj[1+floor(random()*12)::int] || ' ' || style;
    END IF;
    sizes := CASE WHEN cat = 'girls' THEN girl_sizes WHEN cat = 'starter' THEN starter_sizes
      WHEN cat = 'bra' OR style LIKE '%Bra%' OR (cat = 'activewear' AND style LIKE '%Top%') THEN bra_sizes ELSE free_sizes END;
    INSERT INTO products(name,brand,category,price,old_price,description,highlights,specs,sizes,colors,images,source_url,slug,featured,is_bestseller,badge)
    VALUES (nm,'Glamour Boutique',cat,
      greatest(1, round(CASE WHEN cat='combo' THEN mrp*0.6 ELSE src.price END)), round(mrp),
      'Indian favourite ' || lower(style) || ' – soft, breathable, made for daily Indian weather. Every size available.',
      array['Breathable fabric','7+ colours','All sizes available'], coalesce(src.specs,'{}'::jsonb),
      sizes, cols, array(SELECT jsonb_array_elements_text(base)), 'model-clone',
      lower(regexp_replace(nm,'[^a-zA-Z0-9]+','-','g')) || '-' || substr(md5(random()::text),1,8),
      false, random() < 0.15, badge)
    RETURNING id INTO pid;
    INSERT INTO product_variants(product_id,color_name,color_hex,available_sizes,model_photos,sort)
    SELECT pid, c->>'name', c->>'hex', sizes, array(SELECT jsonb_array_elements_text(c->'images')), o::int-1
      FROM jsonb_array_elements(cols) WITH ORDINALITY t(c,o);
    made := made + 1;
  END LOOP;
  RETURN made;
END $$;
REVOKE ALL ON FUNCTION public.seed_model_catalog(text,int,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_model_catalog(text,int,jsonb) TO authenticated;