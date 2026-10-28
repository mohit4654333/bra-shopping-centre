import sleepImg from "@/assets/cat-sleep.png";
import activeImg from "@/assets/cat-active.png";
import type { Product } from "@/lib/types";
import { discountOf } from "@/lib/merch";
import { rankPhotos } from "@/lib/rotate";
import { useRef } from "react";
import { useAutoSlide } from "@/lib/autoslide";

const TONES = ["bg-arch-mint", "bg-arch-peach", "bg-arch-sky", "bg-arch-lavender", "bg-arch-wine"];
const BUILTIN: Record<string, string> = { nightwear: sleepImg, sleepwear: sleepImg, activewear: activeImg };

type Poster = { id: string; title: string; img: string | undefined; cutout: boolean; off: number };

/** Native touch-swipe row (CSS scroll-snap) — no timers or animation loops. */
export function PosterCarousel({ tabs, products, onPick }: {
  tabs: { id: string; label: string }[];
  products: Product[];
  onPick: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useAutoSlide(ref, 3500);
  const posters: Poster[] = tabs.map((t) => {
    const ph = rankPhotos(products, t.id, "even");
    const img = ph[0] ?? BUILTIN[t.id];
    const off = products.reduce((m, p) => (p.category === t.id ? Math.max(m, discountOf(p)) : m), 0);
    return { id: t.id, title: t.label, img, cutout: !ph.length && !!BUILTIN[t.id], off };
  }).filter((p) => p.img);
  if (posters.length === 0) return null;

  return (
    <section className="bg-poster mt-5 py-6">
      <h2 className="px-4 text-center text-2xl font-black leading-tight text-primary md:text-3xl">Styles that bring GOOD LOOKS<br />to your festive fits</h2>
      <div ref={ref} className="mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-4 pb-2 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
        {posters.map((p, k) => (
          <button key={p.id} type="button" onClick={() => onPick(p.id)} className="w-44 shrink-0 snap-start text-center md:w-56">
            <span className={`${TONES[k % TONES.length]} poster-frame relative flex aspect-[4/5] w-full items-end justify-center overflow-hidden`}>
              <img src={p.img} alt={p.title} loading="lazy" decoding="async" draggable={false} className={p.cutout ? "h-[95%] w-auto object-contain object-bottom" : "h-full w-full object-cover"} />
            </span>
            <span className="mt-2 block text-xl font-black text-primary">{p.title}</span>
            <span className="block text-base font-extrabold uppercase text-foreground">{p.off >= 10 ? `Upto ${p.off}% off` : "Shop now"}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
