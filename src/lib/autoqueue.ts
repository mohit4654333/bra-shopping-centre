/** Pure helpers for the auto-queue catalog importer (no network, safe to test). */

/** Build the URL for listing page N (1-based). Supports a {page} placeholder, otherwise sets ?page=N. Page 1 = base URL. */
export function pageUrl(base: string, page: number): string {
  if (base.includes("{page}")) return base.replace(/\{page\}/g, String(page));
  const u = new URL(base);
  // Use the site's own page key: "p" (Zivame/Magento style) unless the saved link already uses "page".
  const keyName = u.searchParams.has("page") ? "page" : u.searchParams.has("p") || /zivame\./i.test(u.hostname) ? "p" : "page";
  if (page <= 1) { u.searchParams.delete(keyName); return u.toString() === new URL(base).toString() ? base : u.toString(); }
  u.searchParams.set(keyName, String(page));
  return u.toString();
}

/** Sites whose "?p=2" just repeats page 1 (Zivame): we walk sort orders and sub-category pages instead. */
export function ignoresPaging(base: string): boolean {
  try { return /zivame\./i.test(new URL(base).hostname); } catch { return false; }
}

const SORTS = ["", "sortby=newarrival&sortorder=desc", "sortby=price&sortorder=asc", "sortby=price&sortorder=desc", "sortby=discount&sortorder=desc"];

/** Ordered list of listing URLs to walk: the category in every sort order, then each sub-category in every sort order. */
export function listingVariants(base: string, subcats: string[]): string[] {
  const withSort = (u: string, s: string) => { if (!s) return u; const x = new URL(u); for (const [k, v] of new URLSearchParams(s)) x.searchParams.set(k, v); return x.toString(); };
  const out: string[] = [];
  for (const u of [base, ...subcats]) for (const s of SORTS) out.push(withSort(u, s));
  return [...new Set(out)];
}

/** Sub-category pages linked from a listing (e.g. /panties.html -> /panties/hipster-panties.html). */
export function findSubcategories(html: string, base: string): string[] {
  const u = new URL(base);
  const folder = u.pathname.replace(/\.html$/i, "").replace(/\/+$/, "");
  if (!folder) return [];
  const esc = folder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(${esc}/[a-z0-9-]+\\.html)`, "gi");
  const set = new Set<string>();
  for (const m of html.matchAll(re)) set.add(new URL(m[1]!, u.origin).toString());
  return [...set].slice(0, 30);
}

/** Normalise a product URL so the same product always has one key (no query, hash or trailing slash). */
export function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    u.search = "";
    u.hostname = u.hostname.toLowerCase();
    return u.toString().replace(/\/$/, "");
  } catch {
    return raw.trim();
  }
}

// Product .html pages have long slugs (4+ hyphens, e.g. /zivame-padded-wired-bra-black.html);
// menu/collection pages are short (/sleepwear-nightwear.html, /bras/work-wear-bra.html).
const PRODUCT_PATH = /(\/products?\/[^/?#]+|\/p\/[^/?#]+|\/buy$|\/[a-z0-9]+(?:-[a-z0-9]+){4,}\.html$|\/[a-z0-9-]+\/\d{5,}(\/buy)?$|\/dp\/[A-Z0-9]{10})/i;
const NOT_PRODUCT = /\/(cart|login|account|wishlist|search|help|faq|blog|stores?|offers?|sitemap|contact|about|policy|terms|track)/i;

// Promo / offer / collection landing pages that look like products but are not
// (e.g. /buy-2-for-1799.html, /bras-buy-3-at-999.html, /flat-50-off-bras, /collections/sale).
const PROMO_SLUG = new RegExp(
  [
    "^buy-?\\d",                                         // buy-2-for-1799, buy3get1
    "\\b\\d+-(?:for|at)-(?:rs-?|inr-?)?\\d+",          // 2-for-799, 3-at-999
    "\\b(?:get|flat|upto|up-to|under|starting-at|starting|min|extra|save)-(?:rs-?)?\\d+", // flat-50-off, under-499
    "\\b\\d+(?:-percent|-pc)?-off\\b",                   // 50-off, 40-percent-off
    "\\bb\\d+g\\d+\\b|\\bbogo\\b|buy-\\d+-get-\\d+",     // b2g1, bogo, buy-2-get-1
    "^(?:offers?|deals?|sale|collections?|promo|promotions?|campaign|clearance|combo-offers?|lp|landing)(?:-|\\.html$|$)",
    "-(?:offers?|deals?|sale|collection|combo-offers?|promo)(?:\\.html)?$",
  ].join("|"),
  "i",
);
const PROMO_SEGMENT = /\/(?:offers?|deals?|sale|campaigns?|promotions?|promo|lp|landing|clp)(?:\/|$)/i;

/** True for promo banner / offer / collection URLs — dropped before any detail fetch. */
export function isPromoUrl(raw: string): boolean {
  let path = raw;
  try { path = new URL(raw, "https://x.local").pathname; } catch { /* use raw */ }
  const slug = decodeURIComponent(path.replace(/\/+$/, "").split("/").pop() ?? "").toLowerCase();
  if (/\/products?\/[^/]+$/i.test(path) && !PROMO_SLUG.test(slug)) return false; // Shopify-style product under /collections/x/products/y
  return PROMO_SLUG.test(slug) || PROMO_SEGMENT.test(path);
}

/** Pull every likely product-page link from a listing page, same site only, deduped, in page order. Promo/offer pages are dropped here. */
export function extractProductLinks(html: string, base: string): string[] {
  const host = new URL(base).hostname.replace(/^www\./, "");
  const listing = canonicalUrl(base);
  // Sub-category menu pages live under the listing's own folder (e.g. /bras.html -> /bras/full-coverage-bra.html).
  const folder = new URL(base).pathname.replace(/\.html$/i, "").replace(/\/+$/, "");
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (href: string) => {
    let abs: URL;
    try { abs = new URL(href.replace(/&amp;/g, "&"), base); } catch { return; }
    if (!/^https?:$/.test(abs.protocol) || abs.hostname.replace(/^www\./, "") !== host) return;
    if (NOT_PRODUCT.test(abs.pathname) || !PRODUCT_PATH.test(abs.pathname) || isPromoUrl(abs.pathname)) return;
    if (folder && /\.html$/i.test(abs.pathname) && abs.pathname.toLowerCase().startsWith(folder.toLowerCase() + "/")) return;
    // Zivame products are always top-level (/name.html); nested .html pages are category menus.
    if (/zivame\./i.test(host) && /\.html$/i.test(abs.pathname) && abs.pathname.split("/").filter(Boolean).length > 1) return;
    const c = canonicalUrl(abs.toString());
    if (c === listing || seen.has(c)) return;
    seen.add(c);
    out.push(c);
  };
  for (const m of html.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)) add(m[1]!);
  // JS-rendered listings often keep links only inside JSON.
  for (const m of html.matchAll(/"(?:url|link|href|productUrl|pdpUrl)"\s*:\s*"([^"]+)"/gi)) add(m[1]!.replace(/\\\//g, "/"));
  return out;
}

/** Keep only URLs not already in the store. */
export function rejectKnown(urls: string[], known: Iterable<string>): string[] {
  const k = new Set([...known].map(canonicalUrl));
  return urls.filter((u) => !k.has(canonicalUrl(u)));
}

/** Parse "Add next 15 products from Sets" → { count: 15, channel: "sets" }. */
export function parseCommand(text: string): { count: number; channel: string } | null {
  const t = text.trim();
  const n = t.match(/(\d{1,3})/);
  const ch = t.match(/(?:from|of|in)\s+(.+?)\s*$/i)?.[1] ?? t.replace(/.*\d+\s*(?:more\s+|new\s+)?(?:products?|items?)?\s*/i, "");
  if (!n || !ch.trim()) return null;
  return { count: Math.max(1, Math.min(50, Number(n[1]))), channel: ch.trim().toLowerCase() };
}

/** Discount % from MRP and selling price (0 when there is no real discount). */
export function discountPercent(price: number, mrp: number): number {
  if (!mrp || !price || mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

/** No artificial wait between imports — concurrency is limited by IMPORT_CONCURRENCY instead. */
export const QUEUE_DELAY_MS = 0;
/** How many product pages import at the same time (browser loop and background Auto-Pilot). */
export const IMPORT_CONCURRENCY = 12;

/** Run `fn` over `items` with at most `limit` running at once; results keep input order. */
export async function pool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>, keepGoing: () => boolean = () => true): Promise<PromiseSettledResult<R>[]> {
  const out: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length && keepGoing()) {
      const i = next++;
      try { out[i] = { status: "fulfilled", value: await fn(items[i]!, i) }; }
      catch (e) { out[i] = { status: "rejected", reason: e }; }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return out.filter(Boolean);
}

/** A scraped page is only saved if it has a name, a price above ₹0, at least one verified photo and at least one size. */
export function isRealProduct(p: { name: string; price: number; photos: number; sizes?: number }): boolean {
  return !!p.name?.trim() && Number(p.price) > 0 && p.photos > 0 && (p.sizes === undefined || p.sizes > 0);
}

/** Auto-Pilot: pick the next channel index starting at `from` (wrapping), skipping channels that came back empty twice in a row. -1 = all done. */
export function autopilotNext(ids: string[], from: number, empty: Record<string, number>): number {
  for (let k = 0; k < ids.length; k++) {
    const i = (from + k) % ids.length;
    if ((empty[ids[i]!] ?? 0) < 2) return i;
  }
  return -1;
}

/** Background Auto-Pilot: products fetched per scan for each channel. */
export const PILOT_BATCH = 60;
/** After this many scans in a row find nothing new, the channel starts again from page 1 (duplicates are skipped). */
export const PILOT_WRAP_AFTER = 3;

/** What one background tick does for a channel: import the next waiting product, or scan for the next batch. Never "stop". */
export function pilotStep(ch: { pending_urls: string[]; dry_scans: number; last_scanned_page: number }):
  { kind: "import"; url: string } | { kind: "scan"; fromPage: number } {
  if (ch.pending_urls.length) return { kind: "import", url: ch.pending_urls[0]! };
  return { kind: "scan", fromPage: ch.dry_scans >= PILOT_WRAP_AFTER ? 0 : ch.last_scanned_page };
}
