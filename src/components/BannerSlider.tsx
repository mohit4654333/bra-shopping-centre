import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type Banner = { id: string; title: string; subtitle: string; image: string; link_type: string; link_value: string };

/** Native swipe slider (CSS scroll-snap): no timers, no per-touch re-renders. */
export function BannerSlider({ banners }: { banners: Banner[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const n = banners.length;
  if (!n) return null;
  const go = (d: number) => {
    const el = ref.current;
    if (!el) return;
    const next = (i + d + n) % n;
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  };
  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const k = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    if (k !== i) setI(k);
  };

  return (
    <section className="relative select-none" aria-roledescription="carousel">
      <div ref={ref} onScroll={onScroll} className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {banners.map((b, k) => {
          const inner = (
            <div className="relative flex h-56 w-full items-center overflow-hidden bg-primary px-8 text-primary-foreground md:h-80 md:px-20">
              {b.image ? <img src={b.image} alt={b.title} draggable={false} loading={k === 0 ? "eager" : "lazy"} decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-70" /> : (
                <><span className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-primary-foreground/10" /><span className="absolute bottom-[-6rem] right-40 h-56 w-56 rounded-full bg-primary-foreground/10" /></>
              )}
              <div className="relative max-w-xl">
                <h2 className="text-3xl font-bold md:text-5xl">{b.title}</h2>
                {b.subtitle && <p className="mt-2 text-base opacity-90 md:text-xl">{b.subtitle}</p>}
                <span className="mt-5 inline-block rounded-full bg-primary-foreground px-5 py-2 text-sm font-semibold text-primary">Shop now →</span>
              </div>
            </div>
          );
          return (
            <div key={b.id} className="w-full shrink-0 snap-start">
              {b.link_type === "product" && b.link_value ? (
                <Link to="/product/$id" params={{ id: b.link_value }} search={{ color: undefined }} draggable={false}>{inner}</Link>
              ) : (
                <Link to="/" search={{ cat: b.link_value || "all" }} hash="shop" draggable={false}>{inner}</Link>
              )}
            </div>
          );
        })}
      </div>
      {n > 1 && (
        <>
          <button type="button" aria-label="Previous offer" onClick={() => go(-1)} className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-card/80 p-2 shadow md:block"><ChevronLeft className="h-5 w-5" /></button>
          <button type="button" aria-label="Next offer" onClick={() => go(1)} className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-card/80 p-2 shadow md:block"><ChevronRight className="h-5 w-5" /></button>
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-card/85 px-3 py-0.5 text-xs font-bold text-foreground shadow">• {i + 1}/{n} •</div>
        </>
      )}
    </section>
  );
}
