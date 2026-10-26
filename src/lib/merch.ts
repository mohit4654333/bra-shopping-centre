/** Storefront merchandising helpers (pure, safe to test). */
import type { Product } from "./types";

type P = Pick<Product, "price" | "old_price">;
type Text = Pick<Product, "name" | "description" | "highlights" | "specs" | "price" | "old_price">;

/** A product counts as a high-discount "Offer" from this percent off MRP. */
export const OFFER_MIN_DISCOUNT = 40;

export function discountOf(p: P): number {
  return p.old_price > p.price && p.price > 0 ? Math.round((1 - p.price / p.old_price) * 100) : 0;
}

/** MRP used for bulk pricing: the stored MRP, or the price when no MRP is saved. */
export function mrpOf(p: P): number {
  return p.old_price > 0 ? p.old_price : p.price;
}

/** Same rule as the database bulk update: MRP minus percent, rounded, never below ₹1. */
export function bulkDiscountPrice(mrp: number, percent: number): number {
  return Math.max(1, Math.round((mrp * (100 - percent)) / 100));
}

/** High-discount products, biggest discount first. Falls back to every discounted product when none reach the threshold. */
export function offerProducts<T extends P>(list: T[]): T[] {
  const byDiscount = (a: T, b: T) => discountOf(b) - discountOf(a);
  const high = list.filter((p) => discountOf(p) >= OFFER_MIN_DISCOUNT);
  return (high.length ? high : list.filter((p) => discountOf(p) > 0)).sort(byDiscount);
}

const text = (p: Text) => `${p.name} ${p.description} ${p.highlights.join(" ")} ${Object.values(p.specs).join(" ")}`.toLowerCase();

// India's most demanded everyday styles.
const COMFORT: [RegExp, number][] = [
  [/t[\s-]?shirt bra/, 5],
  [/seamless/, 4],
  [/non[\s-]?wired|wire[\s-]?free|wirefree|no wire/, 4],
  [/cotton/, 3],
  [/breathable|everyday|daily|all[\s-]?day|soft|comfort/, 1],
];
// Attractive stylish / designer picks.
const STYLE: [RegExp, number][] = [
  [/lace|designer|bridal|embroider/, 3],
  [/push[\s-]?up|plunge|balconette|bralette|strapless/, 2],
  [/printed|floral|satin|mesh|sheer|net\b/, 1],
];
const score = (s: string, rules: [RegExp, number][]) => rules.reduce((n, [re, w]) => n + (re.test(s) ? w : 0), 0);

export function comfortScore(p: Text): number { return score(text(p), COMFORT); }
export function styleScore(p: Text): number { return score(text(p), STYLE); }

/**
 * "Popular" order: everyday comfort picks (T-shirt, seamless, non-wired, cotton) lead,
 * blended with stylish/designer picks — two comfort products, then one stylish — then everything else.
 */
export function popularOrder<T extends Text>(list: T[]): T[] {
  const withIdx = list.map((p, i) => ({ p, i, c: comfortScore(p), s: styleScore(p) }));
  const comfort = withIdx.filter((x) => x.c > 0 && x.c >= x.s).sort((a, b) => b.c - a.c || a.i - b.i);
  const style = withIdx.filter((x) => x.s > 0 && x.s > x.c).sort((a, b) => b.s - a.s || a.i - b.i);
  const rest = withIdx.filter((x) => x.c === 0 && x.s === 0);
  const out: T[] = [];
  let ci = 0, si = 0;
  while (ci < comfort.length || si < style.length) {
    for (let k = 0; k < 2 && ci < comfort.length; k++) out.push(comfort[ci++]!.p);
    if (si < style.length) out.push(style[si++]!.p);
  }
  return [...out, ...rest.map((x) => x.p)];
}

/** Homepage rotation: per category (popular order), ranks 1,3,5… go to the top slider; 2,4,6… stay in Trending. */
export function sliderPicks<T extends Text & { id: string; category: string }>(products: T[], categoryId: string, limit = 10): T[] {
  return popularOrder(products.filter((p) => p.category === categoryId)).filter((_, i) => i % 2 === 0).slice(0, limit);
}
