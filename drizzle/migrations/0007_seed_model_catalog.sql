insert into public.categories(id,label,slug) values ('teen','Teen & Beginners','teen'),('sports','Sports Bras','sports'),('shapewear','Shapewear','shapewear') on conflict (id) do nothing;

create or replace function public.seed_model_catalog(_cat text, _n int)
returns int language plpgsql security definer set search_path=public as $$
declare
  made int := 0; src record; cat text; style text; nm text; cols jsonb; base jsonb; pal jsonb;
  bra_styles text[] := array['T-Shirt Cotton Bra','Padded Push-Up Bra','Non-Padded Daily Cotton Bra','Plunge Lace Bra','Front-Open Bra','Minimiser Full Coverage Bra','Strapless Multiway Bra','Bridal Lace Bra','Nursing Maternity Bra','Seamless Everyday Bra'];
  teen_styles text[] := array['Teen Beginner Slip-On Bra','Teen Cotton Starter Bra','Teen Double-Layer Bra','College Daily Cotton Bra'];
  sport_styles text[] := array['High-Impact Sports Bra','Yoga Racerback Sports Bra','Gym Padded Sports Bra'];
  panty_styles text[] := array['Cotton Hipster Panty','Seamless Laser-Cut Panty','Bikini Panty','High-Waist Tummy Panty','Boyshort Panty','Lace Brief','Period Panty','Teen Cotton Brief'];
  shape_styles text[] := array['Saree Shapewear Petticoat','High-Waist Tummy Tucker','Thigh Shaper Short'];
  adj text[] := array['Desi','Rani','Mehak','Shringar','Kesar','Chandni','Gulab','Noor','Sitara','Anaya','Zoya','Riya'];
  extra jsonb := '[{"name":"Sindoor Red","hex":"#C1121F"},{"name":"Rani Pink","hex":"#E0218A"},{"name":"Wine Maroon","hex":"#722F37"},{"name":"Skin Nude","hex":"#E3BC9A"},{"name":"Jet Black","hex":"#111111"},{"name":"Peacock Blue","hex":"#005F69"},{"name":"Emerald Green","hex":"#0B6E4F"},{"name":"Pure White","hex":"#FAFAFA"},{"name":"Royal Navy","hex":"#1F2A5A"}]';
  bra_sizes text[] := array['30B','30C','32A','32B','32C','32D','34A','34B','34C','34D','36B','36C','36D','38B','38C','38D','40B','40C','40D','42C','42D'];
  free_sizes text[] := array['XS','S','M','L','XL','XXL','3XL','4XL'];
  i int;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Unauthorized'; end if;
  _n := least(greatest(_n,1),100);
  while made < _n loop
    cat := case when _cat='all' then (array['bra','panty','teen','sports','shapewear'])[1+floor(random()*5)::int] else _cat end;
    select * into src from products where category = case when cat in ('bra','teen','sports') then 'bra' else 'panty' end
      and jsonb_array_length(coalesce(colors,'[]'::jsonb))>0 order by random() limit 1;
    if src is null then exit; end if;
    style := case cat when 'teen' then teen_styles[1+floor(random()*4)::int] when 'sports' then sport_styles[1+floor(random()*3)::int]
      when 'shapewear' then shape_styles[1+floor(random()*3)::int] when 'panty' then panty_styles[1+floor(random()*8)::int] else bra_styles[1+floor(random()*10)::int] end;
    nm := adj[1+floor(random()*12)::int] || ' ' || style;
    select coalesce(jsonb_agg(jsonb_build_object('name',c->>'name','hex',c->>'hex','images',
             (select coalesce(jsonb_agg(x),'[]') from (select x from jsonb_array_elements(c->'images') x limit 6) s))),'[]')
      into cols from (select c from jsonb_array_elements(src.colors) c limit 9) t;
    base := cols->0->'images';
    i := 0;
    while jsonb_array_length(cols) < 7 and i < 9 loop
      pal := extra->i;
      if not exists (select 1 from jsonb_array_elements(cols) c where c->>'name'=pal->>'name') then
        cols := cols || jsonb_build_array(pal || jsonb_build_object('images',base));
      end if;
      i := i+1;
    end loop;
    insert into products(name,brand,category,price,old_price,description,highlights,specs,sizes,colors,images,featured,is_active,slug)
    values (nm,'Glamour Boutique',cat, src.price, greatest(src.old_price,src.price), 'Indian favourite '||lower(style)||' – soft, comfortable, made for daily Indian weather. Every size available.',
      array['Breathable fabric for Indian summers','7+ colours','All sizes available'], coalesce(src.specs,'{}'),
      case when cat in ('bra','teen','sports') then bra_sizes else free_sizes end, cols,
      (select coalesce(array_agg(x),'{}') from (select jsonb_array_elements_text(cols->0->'images') x) s), false, true,
      lower(regexp_replace(nm,'[^a-zA-Z0-9]+','-','g'))||'-'||substr(gen_random_uuid()::text,1,8));
    made := made+1;
  end loop;
  return made;
end $$;
revoke all on function public.seed_model_catalog(text,int) from public, anon;
grant execute on function public.seed_model_catalog(text,int) to authenticated;