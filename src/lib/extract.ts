// Pure, runtime-agnostic helpers that turn a product page into structured data.
import type { ColorVariant, ImportedProduct } from "./types";

const COLOR_HEX: Record<string, string> = {
  black: "#1a1a1a", white: "#f7f7f7", ivory: "#fff8e7", cream: "#f5ecd7", red: "#c62828",
  maroon: "#6d1b2b", wine: "#722f37", burgundy: "#7a1f33", pink: "#ec7fa5", "baby pink": "#f4c2c2",
  "rose": "#e8b4b8", blush: "#f1c6c0", peach: "#f6b99b", coral: "#f2765b", orange: "#ef7d22",
  yellow: "#f2c94c", mustard: "#d4a017", gold: "#c9a227", green: "#2e7d32", olive: "#708238",
  mint: "#a8e6cf", teal: "#00796b", blue: "#1e63c6", navy: "#1f2f5a", "sky blue": "#87ceeb",
  turquoise: "#1fb5ad", purple: "#7b1fa2", lavender: "#b9a3e3", lilac: "#c8a2c8", mauve: "#b784a7",
  violet: "#7f3fbf", magenta: "#c2185b", grey: "#8a8a8a", gray: "#8a8a8a", silver: "#c0c0c0",
  brown: "#6d4c41", beige: "#d9c3a5", skin: "#d4a574", nude: "#d8b49c", tan: "#c49a6c",
  coffee: "#6f4e37", charcoal: "#36454f", multicolor: "#e91e63", multi: "#e91e63",
};

export function colorNameToHex(name: string): string {
  const n = name.toLowerCase().trim();
  const direct = COLOR_HEX[n];
  if (direct) return direct;
  const keys = Object.keys(COLOR_HEX).sort((a, b) => b.length - a.length);
  const hit = keys.find((k) => n.includes(k));
  return (hit && COLOR_HEX[hit]) || "#c71585";
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}

export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|li|div|h\d)>/gi, "\n").replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

export function parsePrice(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return 0;
  const m = v.replace(/,/g, "").match(/\d+(\.\d+)?/);
  return m ? Math.round(Number(m[0])) : 0;
}

const JUNK_IMG = /(sprite|logo|icon|favicon|badge|banner|placeholder|loader|spinner|pixel|tracking|avatar|payment|flag|rating|star|arrow|\.svg|\.gif)/i;

/** Turn thumbnail URLs into their large versions and normalise the protocol. */
export function upgradeImageUrl(raw: string, base?: string): string {
  let u = decodeEntities(raw.trim()).replace(/\\\//g, "/").replace(/\\u002F/gi, "/");
  if (u.startsWith("//")) u = "https:" + u;
  if (base && !/^https?:/i.test(u)) {
    try { u = new URL(u, base).href; } catch { return ""; }
  }
  if (!/^https?:\/\//i.test(u)) return "";
  u = u.replace(/^http:\/\//i, "https://");
  // Amazon: ..._AC_SX38_.jpg -> .jpg (full resolution)
  if (/media-amazon|ssl-images-amazon/.test(u)) u = u.replace(/\._[^/]*?_\.(jpe?g|png|webp)/i, ".$1");
  // Shopify: name_100x100.jpg / _small.jpg -> name.jpg
  if (/cdn\.shopify|\/cdn\/shop\//.test(u)) {
    u = u.replace(/_(\d+x\d*|x\d+|pico|icon|thumb|small|compact|medium|large|grande)(@\dx)?(?=\.(jpe?g|png|webp))/i, "");
    u = u.replace(/([?&])width=\d+/, "$1width=1200");
  }
  // Zivame: 1_small.jpg / 1_xsmall.jpg -> 1_large.jpg
  if (/cdn\.zivame\.com/.test(u)) u = u.replace(/\/(\d+)_(xxsmall|xsmall|small|medium|xlarge|thumb)\.(jpe?g|png|webp)/i, "/$1_large.$3");
  // Myntra / Cloudinary style transforms: w_96,h_128 -> bigger
  u = u.replace(/\/h_\d+,q_\d+,w_\d+\//, "/h_1080,q_90,w_810/");
  return u;
}

function imageKey(u: string): string {
  try {
    const x = new URL(u);
    return (x.host + x.pathname).toLowerCase();
  } catch {
    return u;
  }
}

export function dedupeImages(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of list) {
    if (!u) continue;
    const k = imageKey(u);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(u);
  }
  return out;
}

const NUMBERED = /^(.*[/_-])(\d{1,2})((?:_[a-z]+)?\.(?:jpe?g|png|webp))(\?.*)?$/i;

/**
 * Shops often show only the first photo of the other colours. When one colour has a numbered
 * series (1.jpg … 5.jpg) and another colour only has photo 1 with the same pattern, add 2…N.
 * Photos that turn out not to exist are hidden in the browser.
 */
export function expandNumberedGalleries(colors: ColorVariant[]): ColorVariant[] {
  let n = 0;
  for (const c of colors) {
    const nums = c.images.map((u) => Number(u.match(NUMBERED)?.[2] ?? 0)).filter(Boolean);
    if (nums.includes(1)) n = Math.max(n, Math.max(...nums));
  }
  if (n < 2) return colors;
  return colors.map((c) => {
    const first = c.images.find((u) => u.match(NUMBERED)?.[2] === "1");
    if (!first || c.images.length >= n) return c;
    const m = first.match(NUMBERED)!;
    const extra = Array.from({ length: n }, (_, i) => `${m[1]}${i + 1}${m[3]}`);
    return { ...c, images: dedupeImages([first, ...c.images, ...extra]) };
  });
}

/** Every plausible product photo URL on the page, largest-version, de-duplicated. */
export function collectImageCandidates(html: string, base: string): string[] {
  const found: (string | undefined)[] = [];
  const unescaped = html.replace(/\\\//g, "/").replace(/\\u002F/gi, "/");
  const og = [...html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)(?::secure_url)?["'][^>]*content=["']([^"']+)["']/gi)];
  og.forEach((m) => found.push(m[1]));
  for (const m of unescaped.matchAll(/(?:src|data-src|data-original|data-zoom-image|data-old-hires|data-large|data-image|href)=["']([^"']+\.(?:jpe?g|png|webp|avif)(?:\?[^"']*)?)["']/gi)) found.push(m[1]);
  for (const m of unescaped.matchAll(/srcset=["']([^"']+)["']/gi)) {
    const parts = (m[1] ?? "").split(",").map((s) => s.trim().split(/\s+/)[0]);
    if (parts.length) found.push(parts[parts.length - 1]);
  }
  for (const m of unescaped.matchAll(/(?:https?:)?\/\/[^"'\s()<>\\]+?\.(?:jpe?g|png|webp|avif)(?:\?[^"'\s()<>\\]*)?/gi)) found.push(m[0]);
  const urls = found
    .filter((u): u is string => !!u && !JUNK_IMG.test(u))
    .map((u) => upgradeImageUrl(u, base))
    .filter(Boolean);
  return dedupeImages(urls);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

/** Drop undefined keys so optional fields stay truly optional. */
function clean<T extends object>(o: Record<string, unknown>): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function imageList(v: unknown, base: string): string[] {
  return asArray(v as unknown)
    .map((x) => (typeof x === "string" ? x : (x as Json)?.url ?? (x as Json)?.contentUrl))
    .filter((x): x is string => typeof x === "string")
    .map((x) => upgradeImageUrl(x, base))
    .filter(Boolean);
}

export function findJsonLdProducts(html: string): Json[] {
  const out: Json[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(walk);
    const n = node as Json;
    const t = asArray(n["@type"] as string | string[]).map(String);
    if (t.includes("Product") || t.includes("ProductGroup")) out.push(n);
    if (n["@graph"]) walk(n["@graph"]);
  };
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { walk(JSON.parse((m[1] ?? "").trim())); } catch { /* ignore broken blocks */ }
  }
  return out;
}

function addColorImages(map: Map<string, ColorVariant>, name: string, imgs: string[]) {
  const key = name.trim().toLowerCase();
  if (!key) return;
  const cur = map.get(key) ?? { name: name.trim(), hex: colorNameToHex(name), images: [] };
  cur.images = dedupeImages([...cur.images, ...imgs]);
  map.set(key, cur);
}

export function fromJsonLd(html: string, base: string): Partial<ImportedProduct> {
  const products = findJsonLdProducts(html);
  if (!products.length) return {};
  const main: Json = products.find((p) => asArray(p["@type"] as string).includes("ProductGroup")) ?? products[0];
  const colors = new Map<string, ColorVariant>();
  const sizes = new Set<string>();
  const images: string[] = [];
  let price = 0;
  let oldPrice = 0;
  const variants = [...asArray(main.hasVariant as Json[]), ...products.filter((p) => p !== main)];
  for (const p of [main, ...variants] as Json[]) {
    const imgs = imageList(p.image, base);
    images.push(...imgs);
    if (typeof p.color === "string" && p.color) addColorImages(colors, p.color, imgs);
    if (typeof p.size === "string" && p.size) sizes.add(p.size);
    for (const o of asArray(p.offers as Json)) {
      const pr = parsePrice(o?.price ?? o?.lowPrice);
      if (pr && (!price || pr < price)) price = pr;
      const hi = parsePrice(o?.highPrice);
      if (hi > oldPrice) oldPrice = hi;
    }
  }
  const brand = main.brand as Json | string | undefined;
  return clean<ImportedProduct>({
    name: typeof main.name === "string" ? decodeEntities(main.name) : undefined,
    brand: typeof brand === "string" ? brand : typeof brand?.name === "string" ? (brand.name as string) : undefined,
    description: typeof main.description === "string" ? stripTags(main.description) : undefined,
    price: price || undefined,
    old_price: oldPrice > price ? oldPrice : undefined,
    images: dedupeImages(images),
    colors: [...colors.values()],
    sizes: [...sizes],
  });
}

type ShopifyProduct = {
  title: string; vendor?: string; description?: string; price: number; compare_at_price?: number | null;
  options: (string | { name: string; values?: string[] })[]; images: string[];
  media?: { src?: string; alt?: string | null }[];
  variants: { options: string[]; featured_image?: { src: string } | null; price: number; compare_at_price?: number | null }[];
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

export function fromShopify(p: ShopifyProduct, base: string): Partial<ImportedProduct> {
  const optNames = p.options.map((o) => (typeof o === "string" ? o : o.name));
  const ci = optNames.findIndex((n) => /colou?r|shade|print/i.test(n));
  const si = optNames.findIndex((n) => /size/i.test(n));
  const all = p.images.map((u) => upgradeImageUrl(u, base)).filter(Boolean);
  const colors = new Map<string, ColorVariant>();
  const sizes = new Set<string>();
  for (const v of p.variants) {
    if (si >= 0 && v.options[si]) sizes.add(v.options[si]);
    if (ci >= 0 && v.options[ci]) {
      const img = v.featured_image?.src ? [upgradeImageUrl(v.featured_image.src, base)] : [];
      addColorImages(colors, v.options[ci], img);
    }
  }
  // Assign the remaining gallery photos to colours by alt text / filename, else by position after the variant photo.
  const colorList = [...colors.values()];
  if (colorList.length > 1) {
    const media = p.media ?? [];
    for (const c of colorList) {
      const s = slug(c.name);
      const byAlt = media.filter((m) => m.src && m.alt && slug(m.alt).includes(s)).map((m) => upgradeImageUrl(m.src!, base));
      const byName = all.filter((u) => slug(u.split("/").pop() ?? "").includes(s));
      c.images = dedupeImages([...c.images, ...byAlt, ...byName]);
    }
    const starts = colorList.map((c) => all.findIndex((u) => imageKey(u) === imageKey(c.images[0] ?? "")));
    if (starts.every((x) => x >= 0) && new Set(starts).size === starts.length) {
      const sorted = [...starts].sort((a, b) => a - b);
      colorList.forEach((c, i) => {
        const start = starts[i] ?? 0;
        if (c.images.length > 1) return;
        const next = sorted.find((x) => x > start) ?? all.length;
        c.images = dedupeImages([...c.images, ...all.slice(start, next)]);
      });
    }
  } else if (colorList[0]) {
    colorList[0].images = dedupeImages([...colorList[0].images, ...all]);
  }
  const price = Math.round(p.price / 100);
  const compare = p.compare_at_price ? Math.round(p.compare_at_price / 100) : 0;
  return clean<ImportedProduct>({
    name: p.title,
    brand: p.vendor,
    description: p.description ? stripTags(p.description) : undefined,
    price,
    old_price: compare > price ? compare : undefined,
    images: all,
    colors: colorList,
    sizes: [...sizes],
  });
}

export function metaContent(html: string, key: string): string {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`, "i");
  return decodeEntities((html.match(re) ?? html.match(re2))?.[1] ?? "");
}

/** Multi-pack / combo / set listings ("Pack of 3", "Combo", "Multipack", "5 pcs", "2 in 1"). */
export const COMBO_RE = /pack\s*of|\bcombo\b|\bset\b|\bpcs\b|\bmultipack\b|\bvalue\s*pack\b|\b\d+\s*in\s*1\b/i;
export function isComboText(text: string): boolean {
  return COMBO_RE.test(text);
}

export function guessCategory(text: string): string {
  const t = text.toLowerCase();
  if (isComboText(t)) return "set";
  if (/shaper|shapewear|tummy|body ?suit/.test(t)) return "shapewear";
  if (/sports? bra|legging|gym|active|yoga/.test(t)) return "activewear";
  if (/\bset\b|combo|bra (and|&) panty/.test(t)) return "set";
  if (/night|babydoll|nighty|robe|pyjama|pajama|sleep|chemise/.test(t)) return "nightwear";
  if (/pant(y|ies)|hipster|thong|bikini|brief|boyshort/.test(t)) return "panty";
  if (/bra\b|bralette|brassiere/.test(t)) return "bra";
  return "other";
}

/** Combine sources: earlier sources win for scalar fields, richest colour set wins. */
export function mergeProducts(sources: Partial<ImportedProduct>[], sourceUrl: string): ImportedProduct {
  const pick = <K extends keyof ImportedProduct>(k: K) => sources.find((s) => {
    const v = s[k];
    return Array.isArray(v) ? v.length > 0 : typeof v === "object" ? v && Object.keys(v).length : !!v;
  })?.[k];
  const score = (cs?: ColorVariant[]) => (cs ?? []).reduce((n, c) => n + 1 + Math.min(c.images.length, 8) * 2, 0);
  const colors = [...sources].map((s) => s.colors ?? []).sort((a, b) => score(b) - score(a))[0] ?? [];
  const images = dedupeImages([...(pick("images") ?? []), ...colors.flatMap((c) => c.images)]);
  const name = (pick("name") as string) ?? "";
  const description = (pick("description") as string) ?? "";
  const price = (pick("price") as number) ?? 0;
  const old = (pick("old_price") as number) ?? 0;
  return {
    name,
    brand: (pick("brand") as string) ?? "",
    category: (pick("category") as string) ?? guessCategory(name + " " + description),
    price,
    old_price: old > price ? old : 0,
    description,
    highlights: (pick("highlights") as string[]) ?? [],
    specs: (pick("specs") as Record<string, string>) ?? {},
    sizes: [...new Set(((pick("sizes") as string[]) ?? []).map((s) => s.trim()).filter(Boolean))],
    colors: expandNumberedGalleries(colors.map((c) => ({ ...c, hex: c.hex || colorNameToHex(c.name) }))),
    images,
    source_url: sourceUrl,
  };
}

const NUM_FILE = /^(.*\/)(\d{1,2})(_[a-z]+)?\.(jpe?g|png|webp)$/i;

/** Encode spaces etc. in each path segment once, preserving case. */
export function encodePath(u: string): string {
  try {
    const x = new URL(u);
    x.pathname = x.pathname.split("/").map((seg) => { let r = seg; try { r = decodeURIComponent(seg); } catch { /* raw */ } return encodeURIComponent(r); }).join("/");
    return x.href;
  } catch { return u; }
}

/**
 * No-AI colour grouping: shops like Zivame keep each colour's photos in their own folder
 * (…/CODE/1_large.jpg, 2_large.jpg). Each folder = one colour. Colour names come from the
 * swatch link wrapping that folder's thumbnail (…-samba.html), the img alt/title, or the page title.
 */
export function fromImageFolders(html: string, base: string, pageColor = ""): ColorVariant[] {
  const unesc = html.replace(/\\\//g, "/").replace(/\\u002F/gi, "/");
  const folders = new Map<string, Set<number>>();
  const ext = new Map<string, string>();
  for (const m of unesc.matchAll(/(?:https?:)?\/\/[^"'\s()<>\\]+?\/\d{1,2}(?:_[a-z]+)?\.(?:jpe?g|png|webp)/gi)) {
    const u = encodePath(upgradeImageUrl(m[0], base));
    const p = u.match(NUM_FILE);
    if (!p || JUNK_IMG.test(u)) continue;
    const dir = p[1]!;
    if (!folders.has(dir)) folders.set(dir, new Set());
    folders.get(dir)!.add(Number(p[2]));
    ext.set(dir, `${p[3] ?? ""}.${p[4]}`);
  }
  if (!folders.size) return [];
  const names = new Map<string, string>();
  const nameFor = (dir: string, ctx: string) => {
    if (names.has(dir)) return;
    const alt = ctx.match(/(?:alt|title|data-color|data-colour|aria-label)=["']([^"']{2,40})["']/i)?.[1];
    const href = ctx.match(/href=["'][^"']*-([a-z]{2,25})\.html/i)?.[1];
    const n = (alt && !/zivame|product|image/i.test(alt) ? alt : href?.replace(/-/g, " ")) ?? "";
    if (n) names.set(dir, n.replace(/\b\w/g, (c) => c.toUpperCase()).trim());
  };
  for (const dir of folders.keys()) {
    const short = dir.replace(/^https?:/, "");
    let i = unesc.indexOf(short);
    while (i >= 0 && !names.has(dir)) {
      const a = unesc.lastIndexOf("<a ", i);
      const closed = unesc.lastIndexOf("</a>", i);
      const ctx = a > closed && i - a < 800 ? unesc.slice(a, i + 300) : unesc.slice(Math.max(closed + 1, i - 200), i + 300);
      nameFor(dir, ctx);
      i = unesc.indexOf(short, i + 1);
    }
  }
  const out: ColorVariant[] = [];
  let k = 1;
  for (const [dir, nums] of folders) {
    // Only photos actually seen on the page — never invent numbers that may not exist.
    const imgs = [...nums].sort((a, b) => a - b).map((i) => `${dir}${i}${ext.get(dir)}`);
    const name = names.get(dir) || (out.length === 0 && pageColor) || `Colour ${k}`;
    k++;
    if (out.some((c) => c.name.toLowerCase() === name.toLowerCase())) continue;
    out.push({ name, hex: colorNameToHex(name), images: imgs });
  }
  return out;
}

// Competitor brand wiping lives in ./brandwipe; re-exported here for existing imports.
export { cleanBrandText, cleanBrands } from "./brandwipe";
