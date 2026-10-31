import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getProduct, listProducts } from "@/lib/products.functions";
import { imagesForColor } from "@/lib/types";
import { rupees, useCart } from "@/lib/cart";
import { SafeImg } from "@/components/SafeImg";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/BackButton";
import { ReviewsSection } from "@/components/ReviewsSection";
import { LikeButton, ShareButtons } from "@/components/LikeShare";
import { settingsQuery } from "@/lib/store.functions";
import { ProductCard } from "@/components/ProductCard";
import { SizeGuide } from "@/components/SizeGuide";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const productQuery = (id: string) => queryOptions({ queryKey: ["product", id], queryFn: () => getProduct({ data: id }) });

export const Route = createFileRoute("/product/$id")({
  validateSearch: (s: Record<string, unknown>) => ({ color: typeof s["color"] === "string" ? (s["color"] as string) : undefined }),
  loader: async ({ context, params }) => {
    const p = await context.queryClient.ensureQueryData(productQuery(params.id));
    if (!p) throw notFound();
    return p;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.name} – Glamour Boutique` },
          { name: "description", content: loaderData.description.slice(0, 155) },
          { property: "og:title", content: loaderData.name },
          { property: "og:description", content: loaderData.description.slice(0, 155) },
          { property: "og:type", content: "product" },
          { name: "twitter:card", content: "summary_large_image" },
        ]
      : [{ title: "Product unavailable – Glamour Boutique" }, { name: "robots", content: "noindex" }],
  }),
  notFoundComponent: () => (
    <div className="py-24 text-center"><p className="mb-4">This product is no longer available.</p><Link to="/" className="text-primary underline">Back to shop</Link></div>
  ),
  component: ProductPage,
});

function ProductPage() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: p } = useSuspenseQuery(productQuery(id));
  const { add, setStep, setOpen } = useCart();
  const { data: st } = useSuspenseQuery(settingsQuery);
  const initial = Math.max(0, p!.colors.findIndex((c) => c.name === search.color));
  const [ci, setCi] = useState(initial);
  const [img, setImg] = useState(0);
  const [spin, setSpin] = useState(false);
  const drag = useRef<{ x: number; y: number; start: number; moved: boolean; horiz: boolean | null } | null>(null);
  const [size, setSize] = useState(p?.sizes?.[0] ?? "");
  const [qty, setQty] = useState(1);
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const markBroken = (u: string) => setBroken((b) => new Set(b).add(u));
  useEffect(() => { setImg(0); }, [ci]);
  if (!p) return null;
  const gallery = imagesForColor(p, ci).filter((u) => !broken.has(u));
  const shown = Math.min(img, Math.max(0, gallery.length - 1));
  const color = p.colors[ci];
  const off = p.old_price > p.price ? Math.round((1 - p.price / p.old_price) * 100) : 0;

  const pickColor = (i: number) => {
    setCi(i);
    navigate({ search: { color: p.colors[i]?.name }, replace: true, resetScroll: false });
  };
  const addToBag = (buy = false) => {
    if (st.show_sizes && p.sizes.length && !size) {
      toast.error("Please select a size");
      return;
    }
    add({ id: p.id, name: p.name, price: p.price, image: gallery[0] ?? "", color: color?.name ?? "", size }, qty);
    if (buy) { setStep("details"); setOpen(true); return; }
    toast.success("Bag mein add ho gaya");
    setOpen(true);
  };

  return (
    <>
    <div className="mx-auto max-w-7xl px-3 pt-2 md:px-4 md:pt-4">
      <BackButton label="Back to Shop" />
    </div>
    <main className="mx-auto grid max-w-7xl grid-cols-1 gap-4 overflow-x-hidden px-3 py-2 pb-24 md:gap-10 md:px-4 md:py-6 md:pb-6 md:grid-cols-2">
      <div className="flex min-w-0 flex-row gap-2 md:mx-0 md:gap-3 md:rounded-2xl md:border md:bg-card md:p-2">
        <div className="flex max-h-[52vh] w-14 shrink-0 flex-col gap-1.5 overflow-y-auto md:max-h-[640px] md:w-20 md:gap-2 [scrollbar-width:none]">
          {gallery.map((g, i) => (
            <button key={g + i} type="button" onClick={() => setImg(i)} className={`w-full shrink-0 overflow-hidden rounded-xl border-2 ${i === shown ? "border-primary" : "border-border"}`}>
              <SafeImg src={g} onFail={markBroken} className="aspect-[3/4] w-full bg-card object-cover" />
            </button>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2 md:gap-3">
        <div className="relative w-full touch-pan-y select-none overflow-hidden rounded-xl bg-muted"
          onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, start: shown, moved: false, horiz: null }; }}
          onPointerMove={(e) => {
            const d = drag.current; if (!d || gallery.length < 2) return;
            const dx = e.clientX - d.x, dy = e.clientY - d.y;
            // Decide once per touch whether it is a sideways swipe or a page scroll; scrolls never move the photo.
            if (d.horiz === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) d.horiz = Math.abs(dx) > Math.abs(dy) * 1.5;
            if (!d.horiz) return;
            if (Math.abs(dx) > 8) d.moved = true;
            if (spin) { const step = Math.round(dx / 40); setImg(((d.start - step) % gallery.length + gallery.length) % gallery.length); }
          }}
          onPointerUp={(e) => {
            const d = drag.current; drag.current = null;
            if (!d || spin || gallery.length < 2 || !d.horiz) return;
            const dx = e.clientX - d.x;
            if (Math.abs(dx) < Math.abs(e.clientY - d.y) * 1.5) return;
            if (dx < -50) setImg((shown + 1) % gallery.length);
            else if (dx > 50) setImg((shown - 1 + gallery.length) % gallery.length);
          }}
          onPointerCancel={() => { drag.current = null; }}>
          {gallery.length === 0 ? <div className="aspect-[3/4] w-full md:aspect-[2/3]" style={{ background: color?.hex }} aria-label={color?.name} /> : <SafeImg key={gallery[shown] ?? "none"} src={gallery[shown]} onFail={markBroken} alt={`${p.name} ${color?.name ?? ""}`} className="pointer-events-none mx-auto aspect-[3/4] max-h-[52vh] w-full bg-card object-contain md:max-h-none md:aspect-[2/3]" loading="eager" draggable={false} />}
          {gallery.length > 1 && <span className="absolute bottom-3 right-3 rounded-full bg-card/90 px-2 py-0.5 text-xs">{shown + 1}/{gallery.length}</span>}
          {gallery.length > 2 && (
            <button type="button" onClick={() => setSpin((s) => !s)} onPointerDown={(e) => e.stopPropagation()}
              className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-bold shadow ${spin ? "bg-primary text-primary-foreground" : "bg-card/90"}`}>
              🔄 360° {spin ? "ON – ungli ghumaiye" : "View"}
            </button>
          )}
          {gallery.length > 1 && (
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1 md:hidden">
              {gallery.map((_, i) => <span key={i} className={`h-1.5 rounded-full ${i === shown ? "w-4 bg-primary" : "w-1.5 bg-card/80"}`} />)}
            </div>
          )}
        </div>
        {st.show_sizes && p.sizes.length > 0 && (
          <div className="hidden rounded-xl border p-3 md:block">
            <div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold">Size</p><SizeGuide /></div>
            <div className="flex flex-wrap gap-2">
              {p.sizes.map((s) => (
                <button key={s} type="button" onClick={() => setSize(s)} className={`min-w-11 rounded-md border px-2.5 py-1.5 text-sm md:px-3 md:py-2 ${size === s ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary"}`}>{s}</button>
              ))}
            </div>
          </div>
        )}
        </div>
      </div>


      <div className="min-w-0">
        <p className="text-sm font-bold md:font-semibold md:uppercase md:tracking-wide md:text-muted-foreground">{p.brand}</p>
        <h1 className="mt-0.5 text-base font-normal text-muted-foreground md:mt-1 md:text-3xl md:font-semibold md:text-foreground">{p.name}</h1>
        <p className="mt-2 text-xl md:mt-4 md:text-2xl"><b>{rupees(p.price)}</b>{off > 0 && <><span className="ml-2 text-sm text-muted-foreground line-through md:ml-3 md:text-base">MRP {rupees(p.old_price)}</span><span className="ml-2 text-sm font-bold text-primary md:ml-3 md:rounded-full md:bg-primary md:px-3 md:py-0.5 md:text-primary-foreground">{off}% OFF</span></>}</p>
        <p className="text-xs text-muted-foreground">Inclusive of all taxes</p>

        {st.show_colors && p.colors.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-base font-semibold md:text-sm">Select Colour: <span className="font-normal">{color?.name}</span> <span className="text-muted-foreground">({p.colors.length})</span></p>
            <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [scrollbar-width:none]">
              {p.colors.map((c, i) => (
                <button key={c.name + i} type="button" onClick={() => pickColor(i)} title={c.name}
                  className={`w-20 shrink-0 overflow-hidden rounded-lg border-2 text-xs md:w-16 md:rounded-md md:text-[10px] ${i === ci ? "border-primary text-primary" : "border-border"}`}>
                  {c.images[0] ? <SafeImg src={c.images[0]} className="aspect-[3/4] w-full object-cover" /> : <span className="block aspect-[3/4] w-full" style={{ background: c.hex }} />}
                  <span className="block truncate px-1 py-1">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {st.show_sizes && p.sizes.length > 0 && (
          <div className="mt-6 md:hidden">
            <div className="mb-3 flex items-center justify-between"><p className="text-base font-semibold">Select Size</p><SizeGuide /></div>
            <div className="flex flex-wrap gap-3">
              {p.sizes.map((s) => (
                <button key={s} type="button" onClick={() => setSize(s)} className={`grid h-12 min-w-12 place-items-center rounded-full border px-3 text-sm ${size === s ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{s}</button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 hidden items-center gap-2 md:flex">
          <div className="flex h-10 items-center rounded-full border bg-card">
            <button type="button" aria-label="Kam karo" className="h-10 w-9 text-lg" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
            <span className="w-6 text-center text-sm font-semibold">{qty}</span>
            <button type="button" aria-label="Badhao" className="h-10 w-9 text-lg" onClick={() => setQty(qty + 1)}>+</button>
          </div>
          <Button variant={st.buy_now ? "outline" : "default"} className="h-10 flex-1 rounded-full border-primary px-3 text-sm font-semibold text-primary" onClick={() => addToBag()}>Add to Bag</Button>
          {st.buy_now && <Button className="h-10 flex-1 rounded-full px-3 text-sm font-bold" onClick={() => addToBag(true)}>Buy Now</Button>}
        </div>
        <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t bg-card p-2 shadow-lg md:hidden">
          <div className="flex shrink-0 flex-col justify-center px-1 leading-tight"><b className="text-sm">{rupees(p.price)}</b>{size && <span className="text-[10px] text-muted-foreground">Size {size}</span>}</div>
          <Button variant={st.buy_now ? "outline" : "default"} className="h-11 flex-1 rounded-full border-primary text-sm font-semibold text-primary" onClick={() => addToBag()}>Add to Bag</Button>
          {st.buy_now && <Button className="h-11 flex-1 rounded-full text-sm font-bold" onClick={() => addToBag(true)}>Buy Now</Button>}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <LikeButton id={p.id} className="h-10 w-10 border shadow-none" />
          <ShareButtons name={p.name} price={rupees(p.price)} />
        </div>

        {p.highlights.length > 0 && (
          <ul className="mt-8 list-disc space-y-1 pl-5 text-sm">{p.highlights.map((h) => <li key={h}>{h}</li>)}</ul>
        )}
        {p.description && <div className="mt-6"><h2 className="mb-2 text-lg font-semibold">Product details</h2><p className="whitespace-pre-line text-sm text-muted-foreground">{p.description}</p></div>}
        {Object.keys(p.specs).length > 0 && (
          <Accordion type="multiple" defaultValue={["details"]} className="mt-6">
            <AccordionItem value="details">
              <AccordionTrigger>Fabric, padding & wire</AccordionTrigger>
              <AccordionContent>
                <table className="w-full text-sm"><tbody>{Object.entries(p.specs).filter(([k]) => k !== "Wash care").map(([k, v]) => <tr key={k} className="border-b"><td className="py-2 pr-4 text-muted-foreground">{k}</td><td className="py-2">{v}</td></tr>)}</tbody></table>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="care">
              <AccordionTrigger>Wash care</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">{p.specs["Wash care"] ?? "Hand wash cold, dry in shade, do not bleach."}</AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </div>
    </main>
    <ReviewsSection productId={p.id} />
    <SimilarProducts id={p.id} category={p.category} />
    </>
  );
}

function SimilarProducts({ id, category }: { id: string; category: string }) {
  const { data = [] } = useQuery({ queryKey: ["products"], queryFn: () => listProducts() });
  const list = data.filter((x) => x.id !== id && x.category === category).slice(0, 12);
  if (!list.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-3 pb-28 pt-4 md:px-4 md:pb-10">
      <h2 className="mb-3 text-lg font-semibold">You May Also Like</h2>
      <div className="-mx-3 flex snap-x gap-3 overflow-x-auto px-3 pb-2 [scrollbar-width:none]">
        {list.map((x) => <div key={x.id} className="w-40 shrink-0 snap-start md:w-52"><ProductCard p={x} /></div>)}
      </div>
    </section>
  );
}
