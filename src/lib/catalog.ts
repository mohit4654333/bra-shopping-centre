import type { ImportedProduct } from "./types";
import { STORE_BRAND, sanitizeImages } from "./types";
import { cleanBrands } from "./brandwipe";

/** Shopify-style product from a store's /products.json feed. */
export type FeedProduct = {
  id: number;
  title: string;
  handle: string;
  body_html?: string;
  product_type?: string;
  tags?: string[] | string;
  options?: { name: string; values: string[] }[];
  variants?: { id: number; price: string; compare_at_price?: string | null; option1?: string | null; option2?: string | null; option3?: string | null; featured_image?: { src: string } | null }[];
  images?: { src: string; variant_ids?: number[] }[];
};

const HEX: Record<string, string> = {
  black: "#111111", white: "#f5f5f5", red: "#c0392b", pink: "#f4a6c1", blue: "#2e5aa7", navy: "#1f2a44",
  green: "#2e8b57", beige: "#e3cfb4", nude: "#e0b9a0", skin: "#e5bfa5", grey: "#8e8e8e", gray: "#8e8e8e",
  purple: "#7d4ca3", maroon: "#7b1e2b", yellow: "#f2c94c", orange: "#e67e22", brown: "#7b5137", peach: "#f6b99a",
  wine: "#5e1a2e", lavender: "#b9a3d8", mint: "#a8e6cf", coral: "#ff7f6b",
};
export function colorHex(name: string): string {
  const n = name.toLowerCase();
  for (const k of Object.keys(HEX)) if (n.includes(k)) return HEX[k]!;
  return "#cccccc";
}

/** Guess one of the store categories from product type, tags and title. */
export function guessCategory(p: Pick<FeedProduct, "title" | "product_type" | "tags">, known: string[]): string {
  const tags = Array.isArray(p.tags) ? p.tags.join(" ") : p.tags ?? "";
  const t = `${p.product_type ?? ""} ${tags} ${p.title}`.toLowerCase();
  const pick = (id: string) => (known.includes(id) ? id : known.includes("other") ? "other" : known[0] ?? "other");
  if (/shape|tummy|body ?suit|corset|waist/.test(t)) return pick("shapewear");
  if (/night|pyjama|pajama|sleep|lounge|robe|babydoll|chemise/.test(t)) return pick("nightwear");
  if (/\bset\b|bra.*panty|combo set|lingerie set/.test(t)) return pick("set");
  if (/sport|gym|active|legging|yoga/.test(t)) return pick("activewear");
  if (/panty|panties|brief|hipster|bikini|thong|boyshort|knicker|underwear/.test(t)) return pick("panty");
  if (/bra\b|bras\b|bralette|brassiere|camisole|slip/.test(t)) return pick("bra");
  return pick("other");
}

export function stripHtml(html: string): string {
  return (html || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|li|div)>/gi, "\n").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n").trim();
}

/** Convert a feed product into a store product, or null when it has no price or photos. */
export function feedToProduct(p: FeedProduct, origin: string, known: string[]): ImportedProduct | null {
  const variants = p.variants ?? [];
  const opts = p.options ?? [];
  const ci = opts.findIndex((o) => /colou?r|shade/i.test(o.name));
  const si = opts.findIndex((o) => /size|cup|band/i.test(o.name));
  const prices = variants.map((v) => Number(v.price)).filter((n) => n > 0);
  const price = prices.length ? Math.min(...prices) : 0;
  const mrps = variants.map((v) => Number(v.compare_at_price || 0)).filter((n) => n > price);
  const old_price = mrps.length ? Math.max(...mrps) : price;
  const images = sanitizeImages((p.images ?? []).map((i) => i.src));
  if (!price || !images.length) return null;
  const sizes = si >= 0 ? opts[si]!.values.filter(Boolean) : [];
  const key = (`option${ci + 1}`) as "option1" | "option2" | "option3";
  const colors = ci >= 0 ? opts[ci]!.values.map((name) => {
    const ids = new Set(variants.filter((v) => v[key] === name).map((v) => v.id));
    const own = (p.images ?? []).filter((i) => i.variant_ids?.some((id) => ids.has(id))).map((i) => i.src);
    const feat = variants.filter((v) => v[key] === name && v.featured_image).map((v) => v.featured_image!.src);
    const imgs = sanitizeImages([...own, ...feat]);
    return { name, hex: colorHex(name), images: imgs.length ? imgs : images };
  }) : [];
  const product: ImportedProduct = {
    name: p.title.trim(),
    brand: STORE_BRAND,
    category: guessCategory(p, known),
    price,
    old_price,
    description: stripHtml(p.body_html ?? ""),
    highlights: [],
    specs: {},
    sizes,
    colors,
    images,
    source_url: `${origin}/products/${p.handle}`,
  };
  return cleanBrands(product, STORE_BRAND);
}

const COLOR_WORDS = /\b(black|white|red|pink|blue|navy|green|beige|nude|skin|grey|gray|purple|maroon|yellow|orange|brown|peach|wine|lavender|mint|coral|ivory|cream|olive|teal|rust|mauve|rose|magenta|aqua|sky|lilac|burgundy|tan|mocha|charcoal|multi(?:colou?r)?)\b/i;

/** Find a colour name in a title, e.g. "Non-Padded Bra (Wine)" -> base "Non-Padded Bra", colour "Wine". */
export function splitTitleColor(title: string): { base: string; color: string | null } {
  const br = title.match(/^(.*?)[\s-]*[([]([^)\]]+)[)\]]\s*$/);
  if (br && COLOR_WORDS.test(br[2]!)) return { base: br[1]!.trim(), color: br[2]!.trim() };
  const dash = title.match(/^(.*?)\s+[-–|]\s+([^-–|]+)$/);
  if (dash && COLOR_WORDS.test(dash[2]!) && dash[2]!.split(/\s+/).length <= 3) return { base: dash[1]!.trim(), color: dash[2]!.trim() };
  return { base: title.trim(), color: null };
}

/** Shops list each colour as its own product; join same-design items into one product with all its real colours. */
export function mergeColorSiblings(items: ImportedProduct[]): ImportedProduct[] {
  const groups = new Map<string, ImportedProduct>();
  const out: ImportedProduct[] = [];
  for (const p of items) {
    const { base, color } = splitTitleColor(p.name);
    const own = p.colors.length ? p.colors : color ? [{ name: color, hex: colorHex(color), images: p.images }] : [];
    const key = `${base.toLowerCase()}|${p.category}`;
    const g = groups.get(key);
    if (!g || !color) {
      const fresh = { ...p, name: color ? base : p.name, colors: [...own] };
      if (color) groups.set(key, fresh);
      out.push(fresh);
      continue;
    }
    for (const c of own) if (!g.colors.some((x) => x.name.toLowerCase() === c.name.toLowerCase())) g.colors.push(c);
    g.sizes = Array.from(new Set([...g.sizes, ...p.sizes]));
    g.price = Math.min(g.price, p.price);
    g.old_price = Math.max(g.old_price, p.old_price);
  }
  return out;
}

/** Turn any store link into its feed origin, e.g. "enamor.co.in/collections/x" -> "https://enamor.co.in". */
export function feedOrigin(input: string): string {
  const s = input.trim();
  const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  return `${u.protocol}//${u.host}`;
}
