/**
 * Universal competitor brand wiper (pure, runtime-agnostic).
 * Runs on every way a product or review enters the store: auto-queue bot, single link import,
 * manual admin add/edit, and customer/sample reviews.
 */

/** Other shopping sites and lingerie brands that must never appear on the storefront. */
export const COMPETITORS = [
  "zivame", "clovia", "myntra", "nykaa fashion", "nykaa", "amazon", "flipkart", "ajio", "meesho",
  "enamor", "amante", "jockey", "triumph", "wacoal", "pretty secrets", "prettysecrets", "shyaway",
  "tata cliq", "tatacliq", "bewakoof", "libas", "van heusen", "snapdeal", "limeroad", "firstcry",
  "marks & spencer", "marks and spencer", "hunkemoller", "la senza", "victoria's secret", "victorias secret",
  "lavie", "dollar missy", "lux cozi", "souminie", "inner sense", "candyskin",
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*");
const NAMES = COMPETITORS.map(esc).join("|");

/** "zivame", "Zivame.com", "www.myntra.com", "amazon.in" */
const SHOP_RE = new RegExp(`(?:https?:\\/\\/)?(?:www\\.)?\\b(?:${NAMES})(?:\\.com|\\.in|\\.co\\.in)?\\b(?:\\/\\S*)?`, "gi");
/** Whole promo sentences that point to another shop: "Buy on Zivame", "Shop now at Myntra.com!", "Exclusive on Nykaa". */
const SHOP_LINE_RE = new RegExp(
  `(?:\\b(?:buy|shop|order|exclusive(?:ly)?|only|available|sold|get it|find more|explore more|visit)\\b)[^.!\\n]{0,40}?\\b(?:${NAMES})\\b(?:\\.com|\\.in)?[^.!\\n]*[.!]?`,
  "gi",
);
/** Generic "Buy on X.com", "Shop at X.in", "exclusive on X.com" for any website. */
const PROMO_DOMAIN_RE = /\b(?:buy|shop|order|exclusive(?:ly)?|only|available)\b(?:\s+\w+){0,3}?\s+(?:on|at|from)\s+(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.(?:com|in|co\.in|store|shop)\b[^.!\n]*[.!]?/gi;
/** Any leftover web address. */
const DOMAIN_RE = /(?:https?:\/\/)?(?:www\.)[a-z0-9-]+\.[a-z.]{2,6}\S*|https?:\/\/\S+/gi;
/** Manufacturer / style codes like ZI1234, ZI10D3, "Style Code: ZI2042". */
const CODE_RE = /(?:\b(?:style|product|item|article|model|sku|design)\s*(?:code|no\.?|number|#|id)?\s*[:#-]?\s*)?\(?\bZI(?=[A-Z0-9]*\d)[A-Z0-9]{2,}\b\)?/gi;
/** Specification rows that only describe another seller. */
const DROP_SPEC_KEY = /^(?:brand|brand name|manufacturer|manufactured by|marketed by|sold by|seller|packer|importer|style code|sku|product code|article code|article number|model number|model no\.?|item code)$/i;

export function cleanBrandText(s: string, brand: string): string {
  if (!s) return s;
  const b = esc(brand);
  return s
    .replace(SHOP_LINE_RE, "")
    .replace(PROMO_DOMAIN_RE, "")
    .replace(CODE_RE, "")
    .replace(SHOP_RE, brand)
    .replace(DOMAIN_RE, "")
    .replace(new RegExp(`(${b})(?:[\\s'’s]+\\1)+`, "gi"), "$1")
    .replace(/\(\s*\)|\[\s*\]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.!;:])/g, "$1")
    .replace(/^\s*[-|:,]\s*|\s*[-|:,]\s*$/g, "")
    .trim();
}

type Cleanable = { name: string; description: string; highlights: string[]; specs: Record<string, string>; brand?: string; colors?: { name: string }[] };

export function cleanBrands<T extends Cleanable>(p: T, brand: string): T {
  const c = (s: string) => cleanBrandText(s, brand);
  const name = c(p.name);
  const out: T = {
    ...p,
    name: name.replace(new RegExp(`^${esc(brand)}(?:'s)?\\s+`, "i"), "") || name,
    description: c(p.description),
    highlights: p.highlights.map(c).filter(Boolean),
    specs: Object.fromEntries(
      Object.entries(p.specs).map(([k, v]) => [c(k), c(String(v ?? ""))]).filter(([k, v]) => k && v && !DROP_SPEC_KEY.test(k)),
    ),
  };
  if (typeof p.brand === "string") out.brand = c(p.brand) || brand;
  if (Array.isArray(p.colors)) (out as Cleanable).colors = p.colors.map((x) => ({ ...x, name: c(x.name) || x.name }));
  return out;
}
