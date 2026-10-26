import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { startTransition, useEffect, useMemo, useState } from "react";
import { listCategories, listProducts } from "@/lib/products.functions";
import { ProductCard } from "@/components/ProductCard";
import { ArchCategories } from "@/components/ArchCategories";
import { BannerSlider } from "@/components/BannerSlider";
import { PosterCarousel } from "@/components/PosterCarousel";
import { CategoryProductSlider } from "@/components/CategoryProductSlider";
import { bannersQuery, settingsQuery } from "@/lib/store.functions";
import { discountOf, offerProducts, popularOrder, sliderPicks } from "@/lib/merch";
import { productPhotos } from "@/components/CategoryProductSlider";

export const productsQuery = queryOptions({ queryKey: ["products"], queryFn: () => listProducts() });
export const categoriesQuery = queryOptions({ queryKey: ["categories"], queryFn: () => listCategories() });

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { cat?: string; q?: string } => ({
    ...(typeof s["cat"] === "string" ? { cat: s["cat"] as string } : {}),
    ...(typeof s["q"] === "string" && s["q"] ? { q: s["q"] as string } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Glamour Boutique – Bras, Panties & Nightwear in Every Colour" },
      { name: "description", content: "Shop premium bras, panties, nightwear and lingerie sets. See every colour with real photos before you buy." },
      { property: "og:title", content: "Glamour Boutique – Premium Ladies Innerwear" },
      { property: "og:description", content: "Bras, panties, nightwear and lingerie sets in every colour." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(productsQuery), context.queryClient.ensureQueryData(categoriesQuery), context.queryClient.ensureQueryData(bannersQuery)]),
  component: Index,
});

function Index() {
  const { data: products } = useSuspenseQuery(productsQuery);
  const { data: categories } = useSuspenseQuery(categoriesQuery);
  const { data: banners } = useSuspenseQuery(bannersQuery);
  const { data: st } = useSuspenseQuery(settingsQuery);
  const { cat, q: urlQ } = Route.useSearch();
  const [tab, setTab] = useState(cat ?? "featured");
  useEffect(() => { if (cat) setTab(cat); }, [cat]);
  const [q, setQ] = useState(urlQ ?? "");
  useEffect(() => { setQ(urlQ ?? ""); }, [urlQ]);
  const [sort, setSort] = useState("popular");
  const [limit, setLimit] = useState(24);
  useEffect(() => { setLimit(24); }, [tab, q, sort]);
  const offers = useMemo(() => offerProducts(products), [products]);
  const tabs = [...(offers.length ? [{ id: "offers", label: "🔥 Offers" }] : []), { id: "featured", label: "Featured" }, { id: "all", label: "All" }, ...categories.filter((c) => products.some((p) => p.category === c.id))];
  const list = useMemo(() => {
    let l = tab === "offers" ? offers : products.filter((p) => (tab === "all" ? true : tab === "featured" ? p.featured : p.category === tab));
    if ((tab === "featured" || tab === "offers") && l.length === 0) l = products;
    const s = q.trim().toLowerCase();
    if (s) l = products.filter((p) => `${p.name} ${p.brand} ${p.colors.map((c) => c.name).join(" ")}`.toLowerCase().includes(s));
    // Offers stay biggest-discount-first; everything else leads with India's favourite everyday styles.
    if (sort === "popular" && tab !== "offers") l = popularOrder(l);
    // Products shown in the top category slider (ranks 1,3,5…) are skipped here so Trending shows 2,4,6…
    if (!s) {
      const withPhotos = products.filter((p) => productPhotos(p).length > 0);
      const shown = new Set(categories.flatMap((c) => sliderPicks(withPhotos, c.id).map((p) => p.id)));
      const rest = l.filter((p) => !shown.has(p.id));
      if (rest.length) l = rest;
    }
    if (sort === "low") l = [...l].sort((a, b) => a.price - b.price);
    if (sort === "high") l = [...l].sort((a, b) => b.price - a.price);
    return l;
  }, [products, offers, tab, q, sort, categories]);

  const grid = list.length === 0 ? (
    <p className="py-20 text-center text-muted-foreground">No products found.</p>
  ) : (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {list.slice(0, limit).map((p) => <ProductCard key={p.id} p={p} />)}
      {list.length > limit && <button type="button" onClick={() => setLimit((l) => l + 24)} className="col-span-full rounded-full border bg-card py-3 text-sm font-semibold hover:border-primary">Aur dekhein ({list.length - limit})</button>}
    </div>
  );
  const tabBar = (
    <div className="flex flex-wrap items-center gap-2 py-6">
      {tabs.map((t) => (
        <button key={t.id} type="button" onClick={() => startTransition(() => setTab(t.id))} className={`rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wide ${tab === t.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary"}`}>{t.label}</button>
      ))}
      <select value={sort} onChange={(e) => setSort(e.target.value)} className="ml-auto rounded-md border bg-card px-3 py-1.5 text-sm">
        <option value="popular">Popular</option><option value="new">Newest</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option>
      </select>
    </div>
  );

  if (st.landing_layout === "deals") {
    const deal = products.find((p) => p.featured) ?? products[0];
    return (
      <main>
        <section className="bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground">
          🔥 Aaj ki sale khatam hone mein: <Countdown />
        </section>
        {st.offers_banner && <BannerSlider banners={banners} />}
        {deal && (
          <section className="mx-auto max-w-5xl px-4 py-8">
            <h2 className="mb-4 text-2xl font-bold">Deal of the Day</h2>
            <div className="mx-auto max-w-xs"><ProductCard p={deal} /></div>
          </section>
        )}
        <div id="shop" className="mx-auto max-w-7xl px-4">
          <h2 className="pt-4 text-2xl font-bold">Sale par sab kuch</h2>
          {tabBar}{grid}
        </div>
      </main>
    );
  }

  if (st.landing_layout === "minimal") {
    return (
      <main>
        <section className="bg-hero px-4 py-24 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">{st.brand_name}</p>
          <h1 className="mx-auto mt-4 max-w-2xl text-5xl font-bold md:text-6xl">Feel beautiful, every day</h1>
          <p className="mx-auto mt-4 max-w-lg text-muted-foreground">{st.tagline}</p>
          <a href="#shop" className="mt-8 inline-block rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground">Collection dekhein</a>
        </section>
        <section className="mx-auto grid max-w-4xl grid-cols-3 gap-4 px-4 py-10 text-center text-sm">
          <div><div className="text-2xl">📦</div><div className="mt-1 font-semibold">Discreet packaging</div></div>
          <div><div className="text-2xl">🚚</div><div className="mt-1 font-semibold">Fast delivery</div></div>
          <div><div className="text-2xl">🔄</div><div className="mt-1 font-semibold">Easy exchange</div></div>
        </section>
        <div id="shop" className="mx-auto max-w-7xl px-4">{tabBar}{grid}</div>
      </main>
    );
  }

  return (
    <main>
      <section className="mx-auto max-w-7xl px-4 pt-4">
        <ArchCategories tabs={[...categories.filter((c) => c.id !== "other")]} products={products} active={tab} maxOff={offers.length ? discountOf(offers[0]!) : null}
          onPick={(id) => { setTab(id); document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" }); }} />
      </section>
      {st.offers_banner && <BannerSlider banners={banners} />}
      <PosterCarousel tabs={categories.filter((c) => c.id !== "other")} products={products}
        onPick={(id) => { setTab(id); document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" }); }} />
      <CategoryProductSlider categories={categories} products={products} />
      <div id="shop" className="mx-auto max-w-7xl px-4 pb-12">
        <h2 className="pt-2 text-2xl font-extrabold">🔥 Trending Now</h2>
        {tabBar}{grid}
      </div>
    </main>
  );
}

/** Counts down to midnight (real daily reset, not a fake timer). */
function Countdown() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (now === null) return <span>--:--:--</span>;
  const end = new Date(now); end.setHours(24, 0, 0, 0);
  const s = Math.max(0, Math.floor((end.getTime() - now) / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return <span className="tabular-nums">{pad(Math.floor(s / 3600))}:{pad(Math.floor((s % 3600) / 60))}:{pad(s % 60)}</span>;
}
