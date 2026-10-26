import bra from "@/assets/seed/bra.jpg.asset.json";
import panty from "@/assets/seed/panty.jpg.asset.json";
import starter from "@/assets/seed/starter.jpg.asset.json";
import nightwear from "@/assets/seed/nightwear.jpg.asset.json";
import set from "@/assets/seed/set.jpg.asset.json";
import shapewear from "@/assets/seed/shapewear.jpg.asset.json";
import activewear from "@/assets/seed/activewear.jpg.asset.json";

export const BATCHES = [50, 100, 250, 500, 1000] as const;

export const MODEL_CATS = [
  { id: "all", label: "All categories" },
  { id: "bra", label: "Bras (T-Shirt, Padded, Wireless, Balconette, Plunge, Everyday Cotton)" },
  { id: "panty", label: "Panties (Hipster, Bikini, High-Waist, Seamless, Boyshorts)" },
  { id: "girls", label: "Girls & Teen Panties (Cotton hipster, bikini, boyshort, printed brief)" },
  { id: "combo", label: "Combo Packs (Pack of 3 / 4 / 5 panties & bras)" },
  { id: "starter", label: "Starter & Beginners (Slip-on, camisoles, wire-free)" },
  { id: "nightwear", label: "Nightwear & Loungewear (Babydoll, nighties, lounge sets)" },
  { id: "set", label: "Matching Lingerie Sets (Coordinated, lace bridal)" },
  { id: "shapewear", label: "Shapewear & Silhouette (Tummy tuckers, saree shapers)" },
  { id: "activewear", label: "Activewear & Sports (Gym tops, sports tights)" },
] as const;

const abs = (u: string) => (typeof window !== "undefined" && u.startsWith("/") ? window.location.origin + u : u);

/** Photo links per category, served straight from the image CDN (no checks, no scraping). */
export function seedPhotos(): Record<string, string[]> {
  const m = { bra, panty, starter, nightwear, set, shapewear, activewear };
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, [abs(v.url)]]).concat([["girls", [abs(starter.url), abs(panty.url)]], ["combo", [abs(panty.url), abs(set.url)]]]));
}

/** Splits a total into server-sized chunks (max 250 per call). */
export function chunks(total: number, size = 250): number[] {
  const out: number[] = [];
  for (let left = total; left > 0; left -= size) out.push(Math.min(size, left));
  return out;
}
