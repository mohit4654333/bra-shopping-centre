import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getProduct } from "@/lib/products.functions";
import { imagesForColor } from "@/lib/types";
import { rupees, useCart } from "@/lib/cart";
import { SafeImg } from "@/components/SafeImg";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/BackButton";
import { ReviewsSection } from "@/components/ReviewsSection";
import { LikeButton, ShareButtons } from "@/components/LikeShare";
import { settingsQuery } from "@/lib/store.functions";
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
    <div className="mx-auto max-w-7xl px-4 pt-4">
      <BackButton label="Back to Shop" />
    </div>
    <main className="mx-auto grid max-w-7xl grid-cols-1 gap-10 overflow-x-hidden px-4 py-6 md:grid-cols-2">
      <div className="flex min-w-0 flex-row gap-3 rounded-2xl border bg-card p-2">
        <div className="flex max-h-[60vh] w-16 shrink-0 flex-col gap-2 overflow-y-auto md:max-h-[640px] md:w-20 [scrollbar-width:none]">
          {gallery.map((g, i) => (
            <button key={g + i} type="button" onClick={() => setImg(i)} className={`w-full shrink-0 overflow-hidden rounded-xl border-2 ${i === shown ? "border-primary" : "border-border"}`}>
              <SafeImg src={g} onFail={markBroken} className="aspect-[3/4] w-full bg-card object-cover" />
            </button>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="relative w-full touch-pan-y select-none overflow-hidden overscroll-contain rounded-xl bg-muted"
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
          {gallery.length === 0 ? <div className="aspect-[2/3] w-full" style={{ background: color?.hex }} aria-label={color?.name} /> : <SafeImg key={gallery[shown] ?? "none"} src={gallery[shown]} onFail={markBroken} alt={`${p.name} ${color?.name ?? ""}`} className="pointer-events-none mx-auto aspect-[2/3] max-h-[60vh] w-full bg-card object-contain md:max-h-none" loading="eager" draggable={false} />}
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
      </div>

      <div className="min-w-0">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{p.brand}</p>
        <h1 className="mt-1 text-3xl font-semibold">{p.name}</h1>
        <p className="mt-4 text-2xl"><b>{rupees(p.price)}</b>{off > 0 && <><span className="ml-3 text-base text-muted-foreground line-through">MRP {rupees(p.old_price)}</span><span className="ml-3 rounded-full bg-primary px-3 py-0.5 text-sm font-bold text-primary-foreground">{off}% OFF</span></>}</p>
        <p className="text-xs text-muted-foreground">Inclusive of all taxes</p>

        {st.show_colors && p.colors.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-sm font-semibold">Colour: <span className="font-normal">{color?.name}</span> <span className="text-muted-foreground">({p.colors.length} colours)</span></p>
            <div className="flex flex-wrap gap-2">
              {p.colors.map((c, i) => (
                <button key={c.name + i} type="button" onClick={() => pickColor(i)} title={c.name}
                  className={`w-16 overflow-hidden rounded-md border-2 text-[10px] ${i === ci ? "border-primary" : "border-border"}`}>
                  {c.images[0] ? <SafeImg src={c.images[0]} className="aspect-[3/4] w-full object-cover" /> : <span className="block aspect-[3/4] w-full" style={{ background: c.hex }} />}
                  <span className="block truncate px-1 py-0.5">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {st.show_sizes && p.sizes.length > 0 && (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold">Size</p><SizeGuide /></div>
            <div className="flex flex-wrap gap-2">
              {p.sizes.map((s) => (
                <button key={s} type="button" onClick={() => setSize(s)} className={`min-w-12 rounded-md border px-3 py-2 text-sm ${size === s ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary"}`}>{s}</button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center gap-2">
          <div className="flex h-10 items-center rounded-full border bg-card">
            <button type="button" aria-label="Kam karo" className="h-10 w-9 text-lg" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
            <span className="w-6 text-center text-sm font-semibold">{qty}</span>
            <button type="button" aria-label="Badhao" className="h-10 w-9 text-lg" onClick={() => setQty(qty + 1)}>+</button>
          </div>
          <Button variant={st.buy_now ? "outline" : "default"} className="h-10 flex-1 rounded-full border-primary px-3 text-sm font-semibold text-primary" onClick={() => addToBag()}>Add to Bag</Button>
          {st.buy_now && <Button className="h-10 flex-1 rounded-full px-3 text-sm font-bold" onClick={() => addToBag(true)}>Buy Now</Button>}
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
    </>
  );
}
