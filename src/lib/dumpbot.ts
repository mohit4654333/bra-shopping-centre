export const DUMP_CATEGORIES = [
  { slug: "t-shirt-bras", label: "T-Shirt Bras" },
  { slug: "padded-bras", label: "Padded Bras" },
  { slug: "push-up-bras", label: "Push-Up Bras" },
  { slug: "sports-bras", label: "Sports Bras" },
  { slug: "panties", label: "Panties" },
  { slug: "nightwear", label: "Nightwear" },
  { slug: "shapewear", label: "Shapewear" },
  { slug: "lingerie-sets", label: "Lingerie Sets" },
] as const;

/** Split a total into per-category batches (max 100 per call) that add up exactly. */
export function dumpPlan(total: number): { slug: string; label: string; count: number }[] {
  const n = DUMP_CATEGORIES.length;
  const out: { slug: string; label: string; count: number }[] = [];
  DUMP_CATEGORIES.forEach((c, i) => {
    let left = Math.floor(total / n) + (i < total % n ? 1 : 0);
    while (left > 0) {
      const count = Math.min(100, left);
      out.push({ slug: c.slug, label: c.label, count });
      left -= count;
    }
  });
  return out;
}

/** Discount shown on the price pill, from MRP and selling price. */
export function discountPercent(mrp: number, price: number): number {
  return mrp > price && price > 0 ? Math.round((1 - price / mrp) * 100) : 0;
}
