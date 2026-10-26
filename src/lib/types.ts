export type ColorVariant = { name: string; hex: string; images: string[] };

export type Product = {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  old_price: number;
  description: string;
  highlights: string[];
  specs: Record<string, string>;
  badge: string;
  sizes: string[];
  colors: ColorVariant[];
  images: string[];
  source_url: string;
  featured: boolean;
  pinned?: boolean;
  created_at?: string;
};

export type ImportedProduct = Omit<Product, "id" | "featured" | "badge" | "created_at">;

export type Category = { id: string; label: string };

/** Built-in defaults; the live list comes from the categories table. */
export const CATEGORIES: Category[] = [
  { id: "bra", label: "Bras" },
  { id: "panty", label: "Panties" },
  { id: "nightwear", label: "Nightwear" },
  { id: "set", label: "Lingerie Sets" },
  { id: "shapewear", label: "Shapewear" },
  { id: "activewear", label: "Activewear" },
  { id: "other", label: "Other" },
];

/** All photos of a product for one colour, falling back to the general gallery. */
export function imagesForColor(p: Pick<Product, "colors" | "images">, colorIndex: number): string[] {
  const c = p.colors[colorIndex];
  if (c && c.images.length) return c.images;
  const all = p.colors.flatMap((x) => x.images);
  return p.images.length ? p.images : all;
}

export function coverImage(p: Pick<Product, "colors" | "images">): string | undefined {
  return p.images[0] ?? p.colors.find((c) => c.images.length)?.images[0];
}
export const STORE_BRAND = "Glamour Boutique";

/** Turn a label like "Bridal Sets" into a stable id "bridal-sets". */
export function slugifyCategory(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Remove empty links, known-broken links and duplicates (same host+path), keeping order. */
export function sanitizeImages(list: string[], broken: Set<string> = new Set()): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const u = (raw ?? "").trim();
    if (!u || broken.has(u)) continue;
    let key = u.toLowerCase();
    try { const x = new URL(u, "https://x.local"); key = (x.host + x.pathname + (x.searchParams.get("p") ?? "")).toLowerCase(); } catch { /* keep raw */ }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(u);
  }
  return out;
}

/** Minimum distinct photos every colour must have before a product can be saved. */
export const MIN_COLOR_PHOTOS = 3;

/** Names of colours with fewer than MIN_COLOR_PHOTOS distinct working photos. */
export function colorsMissingPhotos(colors: Pick<ColorVariant, "name" | "images">[]): string[] {
  return colors.filter((c) => sanitizeImages(c.images).length < MIN_COLOR_PHOTOS).map((c) => c.name || "Unnamed colour");
}
