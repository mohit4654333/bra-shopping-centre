import type { ColorVariant, ImportedProduct } from "./types";
import {
  collectImageCandidates, colorNameToHex, fromImageFolders, fromJsonLd, fromShopify, guessCategory,
  mergeProducts, metaContent, stripTags, cleanBrands,
} from "./extract";
import { STORE_BRAND } from "./types";
import { fromZivameRsc } from "./zivame";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

async function directFetch(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml", "Accept-Language": "en-IN,en;q=0.9" },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

/** Firecrawl key saved by the admin in Settings (used directly with api.firecrawl.dev). */
let adminKey = "";

/** At most FIRECRAWL_MAX requests run at once; a 429 pauses every request until the reader's reset time, then retries. */
export const FIRECRAWL_MAX = 3;
let fcActive = 0;
let fcPausedUntil = 0;
const fcWaiters: (() => void)[] = [];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function firecrawlFetch(url: string, proxy: "auto" | "stealth" = "auto"): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    while (fcActive >= FIRECRAWL_MAX) await new Promise<void>((r) => fcWaiters.push(r));
    const pause = fcPausedUntil - Date.now();
    if (pause > 0) await wait(pause);
    fcActive++;
    let out: string | number;
    try { out = await firecrawlOnce(url, proxy); } finally { fcActive--; fcWaiters.shift()?.(); }
    if (typeof out === "string") return out;
    fcPausedUntil = Math.max(fcPausedUntil, Date.now() + out * 1000);
  }
  return "";
}

/** Returns html, or the number of seconds to wait when rate limited. */
async function firecrawlOnce(url: string, proxy: "auto" | "stealth"): Promise<string | number> {
  const lov = process.env["LOVABLE_API_KEY"];
  const fc = process.env["FIRECRAWL_API_KEY"] ?? "";
  const direct = adminKey || (fc.startsWith("fc-") ? fc : "");
  if (!direct && (!lov || !fc)) return "";
  try {
    const res = await fetch(direct ? "https://api.firecrawl.dev/v2/scrape" : "https://connector-gateway.lovable.dev/firecrawl/v2/scrape", {
      method: "POST",
      headers: direct
        ? { "Content-Type": "application/json", Authorization: `Bearer ${direct}` }
        : { "Content-Type": "application/json", Authorization: `Bearer ${lov}`, "X-Connection-Api-Key": fc },
      body: JSON.stringify({ url, formats: ["rawHtml"], onlyMainContent: false, waitFor: 1500, proxy, location: { country: "IN" } }),
      signal: AbortSignal.timeout(18000),
    });
    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) {
        const s = Number(body.match(/"retry_after_seconds":\s*(\d+)/)?.[1] ?? 20);
        return Math.min(60, Math.max(2, s + 1));
      }
      console.error("Firecrawl failed", res.status, body);
      return "";
    }
    const j = (await res.json()) as { rawHtml?: string; data?: { rawHtml?: string } };
    return j.rawHtml ?? j.data?.rawHtml ?? "";
  } catch (e) {
    console.error("Firecrawl error", e);
    return "";
  }
}

async function shopifyFetch(url: string): Promise<Partial<ImportedProduct>> {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/products\/([^/?#]+)/);
    if (!m) return {};
    const res = await fetch(`${u.origin}/products/${m[1]}.js`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000) });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("json")) return {};
    return fromShopify(await res.json(), u.origin);
  } catch {
    return {};
  }
}

/** Script snippets that usually hold colour/variant data (Amazon, Myntra, Ajio, Nykaa, etc.). */
function variantSnippets(html: string): string {
  const out: string[] = [];
  const re = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    const s = m[1] ?? "";
    if (s.length < 80) continue;
    if (/colou?r|swatch|variant|colorImages|dimensionValues|hiRes|styleOptions|"images"/i.test(s)) {
      out.push(s.length > 20000 ? s.slice(0, 20000) : s);
    }
  }
  return out.join("\n---\n").slice(0, 60000);
}

type AiResult = {
  name?: string; brand?: string; category?: string; price?: number; old_price?: number;
  description?: string; highlights?: string[]; specs?: { key: string; value: string }[]; sizes?: string[];
  general_image_ids?: number[]; colors?: { name: string; hex?: string; image_ids: number[] }[];
};

async function aiExtract(html: string, url: string, candidates: string[]): Promise<Partial<ImportedProduct>> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return {};
  const head = (html.match(/<head[\s\S]*?<\/head>/i)?.[0] ?? "").replace(/<style[\s\S]*?<\/style>/gi, "").slice(0, 15000);
  const body = stripTags(html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "")).slice(0, 18000);
  const list = candidates.slice(0, 300).map((u, i) => `${i}: ${u}`).join("\n");
  const prompt = `Extract the product on this e-commerce page: ${url}

Rules:
- Prices in INR whole numbers. price = current selling price, old_price = MRP/strikethrough (0 if none).
- colors: EVERY colour option the product is sold in (not just black/white). For each colour list the ids of ALL its photos (model shots, flat lays, back, detail) from the IMAGE LIST. Use colour names in URLs, alt text, variant JSON and swatches to map photos to colours. Never invent ids.
- general_image_ids: all real product/model photos in display order (no logos, icons, ads, other products, size charts).
- sizes: every size option exactly as shown (e.g. 32B, 34C, S, M, XL).
- description: full product description. highlights: short bullet features. specs: fabric, padding, wiring, coverage, closure, wash care, etc.
- If this is NOT a single product page (404, error, captcha, category listing), return name as an empty string.
- category: one of bra, panty, nightwear, set, shapewear, activewear, other.

HEAD:
${head}

VISIBLE TEXT:
${body}

VARIANT DATA:
${variantSnippets(html)}

IMAGE LIST:
${list}`;
  try {
    const str = { type: "string" };
    const ints = { type: "array", items: { type: "integer" } };
    const schema = {
      type: "object",
      additionalProperties: false,
      required: ["name", "brand", "category", "price", "old_price", "description", "highlights", "specs", "sizes", "general_image_ids", "colors"],
      properties: {
        name: str, brand: str, category: str, price: { type: "number" }, old_price: { type: "number" }, description: str,
        highlights: { type: "array", items: str },
        specs: { type: "array", items: { type: "object", additionalProperties: false, required: ["key", "value"], properties: { key: str, value: str } } },
        sizes: { type: "array", items: str },
        general_image_ids: ints,
        colors: {
          type: "array",
          items: { type: "object", additionalProperties: false, required: ["name", "hex", "image_ids"], properties: { name: str, hex: str, image_ids: ints } },
        },
      },
    };
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Lovable-API-Key": key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        input: [{ role: "user", content: prompt }],
        reasoning: { effort: "low" },
        store: false,
        stream: true,
        text: { format: { type: "json_schema", name: "product", strict: true, schema } },
      }),
    });
    if (!res.ok || !res.body) {
      console.error("AI extract failed", res.status, await res.text());
      return {};
    }
    // Read the SSE stream and collect the JSON text.
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let text = "";
    let done = false;
    while (!done) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buf += dec.decode(chunk.value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const ev = JSON.parse(payload);
          if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
          else if (ev.type === "response.output_text.done" && ev.text) { text = ev.text; done = true; }
          else if (ev.type === "response.failed" || ev.type === "error") console.error("AI stream error", payload);
        } catch { /* partial line */ }
      }
    }
    if (!text) return {};
    const r = JSON.parse(text) as AiResult;
    const ids = (a?: number[]) => (a ?? []).map((i) => candidates[i]).filter((x): x is string => !!x);
    const colors: ColorVariant[] = (r.colors ?? []).map((c) => ({
      name: c.name,
      hex: /^#[0-9a-f]{6}$/i.test(c.hex ?? "") ? c.hex! : colorNameToHex(c.name),
      images: ids(c.image_ids),
    }));
    const out: Record<string, unknown> = {
      name: r.name, brand: r.brand, category: r.category, price: r.price, old_price: r.old_price,
      description: r.description, highlights: r.highlights,
      specs: Object.fromEntries((r.specs ?? []).map((s) => [s.key, s.value])),
      sizes: r.sizes, images: ids(r.general_image_ids), colors,
    };
    return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined && v !== "")) as Partial<ImportedProduct>;
  } catch (e) {
    console.error("AI extract error", e);
    return {};
  }
}


const BLOCK_RE = /captcha|robot check|access denied|enable javascript|site maintenance|are you a human|request blocked|forbidden|unusual traffic|cf-chl|just a moment/i;
const PRODUCT_RE = /"@type"\s*:\s*"Product|og:type"\s+content="(?:og:)?product|productData|itemprop="price"|"price"\s*:|"sellingPrice"|"mrp"|₹\s?\d|Rs\.?\s?\d/i;

/** True when a page is missing, tiny, a block/challenge page, or has no sign of a product. Generic for any website. */
export function looksBlocked(html: string): boolean {
  if (!html || html.length < 15000) return true;
  const title = html.match(/<title>([^<]*)/i)?.[1] ?? "";
  if (BLOCK_RE.test(title)) return true;
  return !PRODUCT_RE.test(html);
}

/** Website reader: normal mode first, then stronger "stealth" mode if the site still serves a block page. */
async function readerFetch(url: string): Promise<string> {
  const a = await firecrawlFetch(url, "auto");
  if (a && !looksBlocked(a)) return a;
  const b = await firecrawlFetch(url, "stealth");
  if (b && !looksBlocked(b)) return b;
  return b.length > a.length ? b : a;
}

/** Full pipeline: shop API → page (direct, then Firecrawl) → structured data → AI mapping of every colour's photos. */
export async function runImport(url: string, html0 = "", firecrawlKey = ""): Promise<ImportedProduct> {
  adminKey = firecrawlKey;
  const pasted = !!html0;
  const [shopify, direct] = await Promise.all([
    url ? shopifyFetch(url) : Promise.resolve<Partial<ImportedProduct>>({}),
    pasted ? Promise.resolve(html0) : directFetch(url),
  ]);
  let html = direct;
  let usedReader = false;
  if (url && !pasted && !shopify.name && looksBlocked(html)) {
    const fc = await readerFetch(url);
    usedReader = true;
    if (fc && (!looksBlocked(fc) || fc.length > html.length)) html = fc;
  }
  if (!html && !shopify.name) {
    throw new Error("This website blocked us. Open the page, press Ctrl+U, copy everything and use 'Paste page source'.");
  }
  const first = await parsePage(url, html, shopify).catch((e: Error) => e);
  const weak = first instanceof Error || (!first.price && !first.images.length);
  // A page that slipped past the block check but held no real product: retry once through the website reader.
  if (weak && url && !pasted && !shopify.name) {
    // Reader already tried both modes: don't block on another slow retry.
    const fc = usedReader ? "" : await firecrawlFetch(url, "stealth");
    if (fc) {
      const second = await parsePage(url, fc, shopify).catch((e: Error) => e);
      if (!(second instanceof Error) && (second.price || second.images.length)) return second;
    }
  }
  if (first instanceof Error) throw first;
  if (!first.price && !first.images.length) {
    throw new Error("No product found on that page (it may be removed, or the site blocked us). Try 'Paste page source'.");
  }
  return first;
}

/** Plain HTML/DOM reading of title, price and sizes — works with no AI at all. */
export function fromDom(html: string): Partial<ImportedProduct> {
  const out: Partial<ImportedProduct> = {};
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  if (h1) { const t = stripTags(h1).trim(); if (t.length > 3 && t.length < 200) out.name = t; }
  const num = (v?: string) => (v ? Math.round(Number(v.replace(/[,\s]/g, ""))) : 0);
  const price =
    num(metaContent(html, "product:price:amount") || metaContent(html, "og:price:amount")) ||
    num(html.match(/itemprop=["']price["'][^>]*content=["']([\d.,]+)/i)?.[1]) ||
    num(html.match(/"(?:sellingPrice|selling_price|finalPrice|offerPrice|price)"\s*:\s*"?([\d.,]+)/i)?.[1]) ||
    num(html.match(/(?:₹|Rs\.?)\s?([\d,]+(?:\.\d+)?)/i)?.[1]);
  if (price > 0) out.price = price;
  const mrp = num(html.match(/"(?:mrp|MRP|listPrice|regular_price|compareAtPrice)"\s*:\s*"?([\d.,]+)/)?.[1]);
  if (mrp > price && price > 0) out.old_price = mrp;
  const sizes = new Set<string>();
  const SIZE = /^(?:XXS|XS|S|M|L|XL|XXL|2XL|3XL|4XL|5XL|Free ?Size|\d{2}[A-H]{1,3}|\d{2})$/i;
  for (const m of html.matchAll(/"(?:size|sizeLabel|size_label|label)"\s*:\s*"([^"]{1,10})"/g)) if (SIZE.test(m[1]!.trim())) sizes.add(m[1]!.trim().toUpperCase());
  for (const m of html.matchAll(/<(?:button|li|label|span|option)[^>]*(?:size|variant)[^>]*>\s*([^<]{1,10}?)\s*</gi)) if (SIZE.test(m[1]!.trim())) sizes.add(m[1]!.trim().toUpperCase());
  if (sizes.size) out.sizes = [...sizes];
  return out;
}

async function parsePage(url: string, html: string, shopify: Partial<ImportedProduct>): Promise<ImportedProduct> {
    const base = url || "https://example.com";
    const jsonLd: Partial<ImportedProduct> = html ? fromJsonLd(html, base) : {};
    const candidates = html ? collectImageCandidates(html, base) : [];
    const dom: Partial<ImportedProduct> = html ? fromDom(html) : {};
    const meta: Partial<ImportedProduct> = html
      ? {
          name: metaContent(html, "og:title") || (html.match(/<title>([^<]*)/i)?.[1] ?? "").trim(),
          description: metaContent(html, "og:description") || metaContent(html, "description"),
          images: candidates.slice(0, 6),
        }
      : {};

    const pageColor = (url.match(/-([a-z]+)\.html/i)?.[1] ?? "").replace(/\b\w/g, (c) => c.toUpperCase());
    const zivame: Partial<ImportedProduct> = html ? fromZivameRsc(html) : {};
    const folders: Partial<ImportedProduct> = html && !zivame.colors ? { colors: fromImageFolders(html, base, pageColor) } : {};
    // Pure HTML first. AI is only an optional helper when the page itself lacks price, photos or sizes,
    // and any AI failure (credits, timeout) simply falls back to the HTML result.
    const pre = mergeProducts([shopify, zivame, jsonLd, folders, dom, meta], url);
    const complete = !!pre.name && pre.price > 0 && (pre.images.length > 0 || pre.colors.some((c) => c.images.length > 0)) && pre.sizes.length > 0;
    const ai: Partial<ImportedProduct> = html && !complete ? await aiExtract(html, url, candidates).catch(() => ({})) : {};
    if (!shopify.name && !zivame.name && !jsonLd.name && !ai.name && !meta.name) {
      throw new Error("No product found on that page (it may be removed, or the site blocked us). Try 'Paste page source'.");
    }
    const merged = mergeProducts([shopify, zivame, jsonLd, folders, dom, ai, meta], url);
    if (!merged.category || merged.category === "other") merged.category = ai.category || guessCategory(merged.name + " " + merged.description);
    if (!merged.name) throw new Error("Could not find a product on that page. Try 'Paste page source'.");
    merged.brand = STORE_BRAND;
    return await verifyPhotos(cleanBrands(merged, STORE_BRAND));
}


/** Cheap, offline photo check: keep only real image links (no network HEAD calls — they made each import ~6–20s slower). */
export function looksLikeImage(u: string): boolean {
  try {
    const x = new URL(u);
    if (!/^https?:$/.test(x.protocol)) return false;
    const path = x.pathname.toLowerCase();
    if (/(sprite|logo|icon|placeholder|blank|loader|spacer|pixel|badge|banner)/.test(path)) return false;
    return /\.(jpe?g|png|webp|avif)$/.test(path) || /\/(image|img|media|catalog|product)/.test(path) || x.searchParams.has("format");
  } catch { return false; }
}

/** Drop non-photo links, and give colours with no real photos the product's main photos. */
async function verifyPhotos(p: ImportedProduct): Promise<ImportedProduct> {
  const keep = (l: string[]) => [...new Set(l)].filter(looksLikeImage);
  const images = keep(p.images);
  const colors: ColorVariant[] = p.colors.map((c) => {
    const imgs = keep(c.images);
    return { ...c, images: imgs.length ? imgs : images };
  });
  const mainImages = images.length ? images : [...new Set(colors.flatMap((c) => c.images))];
  return { ...p, images: mainImages, colors: colors.map((c) => (c.images.length ? c : { ...c, images: mainImages })) };
}

/** Fetch a category/listing page: direct first, then the website reader when blocked or JS-only. */
export async function fetchListingHtml(url: string, firecrawlKey = ""): Promise<string> {
  adminKey = firecrawlKey;
  const direct = await directFetch(url);
  const hasLinks = (h: string) => (h.match(/<a\s[^>]*href=/gi) ?? []).length > 40;
  if (direct && direct.length > 15000 && hasLinks(direct) && !BLOCK_RE.test(direct.match(/<title>([^<]*)/i)?.[1] ?? "")) return direct;
  const a = await firecrawlFetch(url, "auto");
  if (a && hasLinks(a)) return a;
  const b = await firecrawlFetch(url, "stealth");
  return [direct, a, b].sort((x, y) => y.length - x.length)[0] ?? "";
}
