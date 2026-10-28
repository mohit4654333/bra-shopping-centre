import sleepImg from "@/assets/cat-sleep.png";
import activeImg from "@/assets/cat-active.png";
import type { Product } from "@/lib/types";
import { rankPhotos, useTick } from "@/lib/rotate";

const TONES = ["bg-arch-peach", "bg-arch-mint", "bg-arch-wine", "bg-arch-sky", "bg-arch-lavender"];
const BUILTIN: Record<string, string> = { nightwear: sleepImg, sleepwear: sleepImg, activewear: activeImg };
const LABELS: Record<string, string> = { nightwear: "SLEEPWEAR" };

export function ArchCategories({ tabs, products, active, maxOff, onPick }: {
  tabs: { id: string; label: string }[];
  products: Product[];
  active: string;
  maxOff: number | null;
  onPick: (id: string) => void;
}) {
  const tick = useTick(2800);
  return (
    <div className="-mx-4 mt-4 flex items-start gap-3 overflow-x-auto px-4 pb-2 pt-1">
      {(
        <button type="button" onClick={() => onPick("offers")} aria-label="Sale is live — offers" className="flex w-24 shrink-0 flex-col items-center gap-1.5">
          <span className={`bg-arch-sale relative flex h-28 w-24 flex-col items-center justify-center overflow-hidden rounded-b-2xl rounded-t-full text-primary-foreground shadow-lg ring-2 ring-offset-2 ring-offset-background ${active === "offers" ? "ring-primary" : "ring-transparent"}`}>
            <span className="text-2xl leading-none">🔥</span>
            <span className="mt-1 text-[10px] font-black leading-tight tracking-wider">SALE IS</span>
            <span className="text-sm font-black leading-tight tracking-wider">LIVE</span>
            {maxOff ? <span className="mt-1 rounded-full bg-background px-2 py-0.5 text-[10px] font-extrabold text-primary">UPTO {maxOff}%</span> : null}
          </span>
          <span className="text-center text-[11px] font-extrabold uppercase tracking-wide text-primary">Sale is live</span>
        </button>
      )}
      {tabs.filter((t) => t.id !== "offers").map((t, k) => {
        const ph = rankPhotos(products, t.id, "odd");
        const img = ph.length ? ph[tick % ph.length] : BUILTIN[t.id];
        const cutout = !ph.length && !!BUILTIN[t.id];
        return (
          <button key={t.id} type="button" onClick={() => onPick(t.id)} className="flex w-24 shrink-0 flex-col items-center gap-1.5">
            <span className={`${TONES[k % TONES.length]} relative flex h-28 w-24 items-end justify-center overflow-hidden rounded-b-2xl rounded-t-full ring-2 ring-offset-2 ring-offset-background ${active === t.id ? "ring-primary" : "ring-transparent"}`}>
              {img ? (
                <img key={img} src={img} style={{ animation: "fade-in 0.6s ease" }} alt={t.label} loading="lazy" className={cutout ? "h-[95%] w-auto object-contain object-bottom" : "h-full w-full object-cover"} />
              ) : <span className="mb-8 text-3xl">✨</span>}
            </span>
            <span className="text-center text-[11px] font-bold uppercase tracking-wide">{LABELS[t.id] ?? t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
