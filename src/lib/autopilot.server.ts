import { canonicalUrl, extractProductLinks, findSubcategories, ignoresPaging, isPromoUrl, isRealProduct, listingVariants, pageUrl, pilotStep, PILOT_BATCH, rejectKnown, pool, IMPORT_CONCURRENCY } from "./autoqueue";
import { fetchListingHtml, runImport } from "./import.server";
import { cleanBrands } from "./extract";
import { STORE_BRAND, sanitizeImages } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any;

export async function firecrawlKey(sb: Sb): Promise<string> {
  const { data } = await sb.from("app_secrets").select("value").eq("name", "firecrawl").maybeSingle();
  return (data?.value as string) || "";
}

const variantCache = new Map<string, string[]>();
async function variantsFor(url: string, key: string): Promise<string[]> {
  const hit = variantCache.get(url);
  if (hit) return hit;
  const html = await fetchListingHtml(url, key);
  const list = listingVariants(url, html ? findSubcategories(html, url) : []);
  variantCache.set(url, list);
  return list;
}

/** Listing pages fetched at the same time while harvesting links. */
export const SCAN_PARALLEL = 2;

/** Scan listing pages after `fromPage` until `count` new product links are found (max `maxPages` pages), several pages at once. */
export async function scanPages(sb: Sb, url: string, fromPage: number, count: number, key: string, maxPages = 8) {
  const fresh: string[] = [];
  const seen = new Set<string>();
  let skipped = 0, page = fromPage, emptyPages = 0, ended = false;
  const variants = ignoresPaging(url) ? await variantsFor(url, key) : null;
  while (page - fromPage < maxPages && fresh.length < count && !ended) {
    const pages: number[] = [];
    for (let k = 0; k < SCAN_PARALLEL && page + pages.length - fromPage < maxPages; k++) {
      const n = page + pages.length + 1;
      if (variants && n > variants.length) break;
      pages.push(n);
    }
    if (!pages.length) { ended = true; break; }
    const htmls = await Promise.all(pages.map((n) => fetchListingHtml(variants ? variants[n - 1]! : pageUrl(url, n), key).catch(() => "")));
    // Pages that failed to load (reader busy / rate limited) must not count as scanned — stop here and retry them next time.
    if (htmls.every((h) => !h)) {
      if (fresh.length) break;
      throw new Error("Website reader is busy (rate limit) — waiting and retrying the same page");
    }
    const batch: string[] = [];
    htmls.forEach((html, k) => {
      const links = html ? extractProductLinks(html, url) : [];
      if (!links.length) { if (!variants && (++emptyPages >= 2 || pages[k] === 1)) ended = true; return; }
      emptyPages = 0;
      for (const l of links) { const c = canonicalUrl(l); if (!seen.has(c)) { seen.add(c); batch.push(l); } }
    });
    page = pages[pages.length - 1]!;
    if (variants && page >= variants.length) ended = true;
    if (!batch.length) continue;
    // One duplicate lookup per round instead of one per page.
    const { data: known } = await sb.from("products").select("source_url").in("source_url", batch.map(canonicalUrl));
    const newOnes = rejectKnown(batch, (known ?? []).map((r: { source_url: string }) => r.source_url));
    skipped += batch.length - newOnes.length;
    fresh.push(...newOnes);
  }
  return { fresh, skipped, page, ended };
}

/** Import one product page and save it live. */
export async function importProduct(sb: Sb, rawUrl: string, category: string, key: string, channelId?: string) {
  const url = canonicalUrl(rawUrl);
  if (isPromoUrl(url)) throw new Error("Offer/promo page, not a product — skipped");
  const { data: dup } = await sb.from("products").select("id").eq("source_url", url).limit(1);
  if (dup?.length) return { status: "duplicate" as const, name: "" };
  const p = cleanBrands(await runImport(url, "", key), STORE_BRAND);
  const images = sanitizeImages(p.images);
  const colors = p.colors.map((c) => ({ ...c, images: sanitizeImages(c.images) }));
  const photoCount = images.length + colors.reduce((n, c) => n + c.images.length, 0);
  if (!isRealProduct({ name: p.name, price: p.price, photos: photoCount, sizes: p.sizes.length })) {
    throw new Error("Not a complete product page (missing price, photos or sizes) — skipped");
  }
  const { error } = await sb.from("products").insert({
    name: p.name, brand: STORE_BRAND, category, price: p.price, old_price: p.old_price,
    description: p.description, highlights: p.highlights, specs: p.specs, sizes: p.sizes,
    colors, images, source_url: url, featured: true, badge: "New",
  });
  if (error) throw new Error(error.message);
  if (channelId) await bumpImported(sb, channelId);
  return { status: "added" as const, name: p.name };
}

type PilotChannel = { id: string; url: string; category: string; pending_urls: string[]; dry_scans: number; last_scanned_page: number };

export const PILOT_TICK_BUDGET_MS = 45_000;
export const PILOT_PARALLEL = IMPORT_CONCURRENCY;

/** One background tick for one channel: within the budget, import pending links 12 at a time, rescanning when the queue empties. */
export async function pilotTick(sb: Sb, ch: PilotChannel, key: string) {
  const until = Date.now() + PILOT_TICK_BUDGET_MS;
  let cur = { ...ch };
  for (let round = 0; round < 4 && Date.now() < until; round++) {
    if (!cur.pending_urls.length) {
      await pilotScan(sb, cur, key);
      const { data } = await sb.from("import_channels").select("*").eq("id", ch.id).maybeSingle();
      if (!data?.autopilot || !data.pending_urls?.length) return;
      cur = data as PilotChannel;
    }
    const queue = [...cur.pending_urls];
    const taken: string[] = [];
    let added = 0;
    let lastErr: string | null = null;
    // Continuous worker pool: a free slot grabs the next link immediately (no waiting for a whole group).
    const results = await pool(queue, PILOT_PARALLEL, async (url) => {
      taken.push(url);
      const r = await importProduct(sb, url, ch.category, key);
      if (r.status === "added") added++;
      return r;
    }, () => Date.now() < until);
    for (const r of results) if (r.status === "rejected") lastErr = r.reason instanceof Error ? r.reason.message.slice(0, 300) : "failed";
    const left = queue.filter((u) => !taken.includes(u));
    const { data: row } = await sb.from("import_channels").select("imported_count").eq("id", ch.id).maybeSingle();
    await sb.from("import_channels").update({
      pending_urls: left, last_run: new Date().toISOString(),
      imported_count: (row?.imported_count ?? 0) + added,
      ...(added ? { last_sync_timestamp: new Date().toISOString() } : {}),
      last_error: added || !lastErr ? null : lastErr,
    }).eq("id", ch.id);
    cur = { ...cur, pending_urls: left };
    if (left.length) return; // budget used up; the next tick continues
  }
}

/** Scan the next listing pages for 10 new product links; after repeated empty scans it loops back to page 1. */
async function pilotScan(sb: Sb, ch: PilotChannel, key: string) {
  const step = pilotStep(ch);
  if (step.kind !== "scan") return;
  const now = new Date().toISOString();
  try {
    const s = await scanPages(sb, ch.url, step.fromPage, PILOT_BATCH, key, 8);
    const found = s.fresh.slice(0, PILOT_BATCH);
    await sb.from("import_channels").update({
      pending_urls: found,
      // Category ran out of pages (or nothing new): loop back to page 1 so new arrivals are picked up.
      last_scanned_page: found.length ? s.page : s.ended || step.fromPage === 0 ? 0 : s.page,
      dry_scans: found.length || s.ended ? 0 : (step.fromPage === 0 ? 0 : ch.dry_scans + 1), last_run: now,
      last_error: found.length ? null : key ? "No new products on these pages — moving on" : "No products found — check the Firecrawl key in Settings",
    }).eq("id", ch.id);
  } catch (e) {
    await sb.from("import_channels").update({ dry_scans: ch.dry_scans + 1, last_run: now, last_error: e instanceof Error ? e.message.slice(0, 300) : "scan failed" }).eq("id", ch.id);
  }
}

// Parallel imports finish together; serialise the counter bump per channel so none are lost.
const bumpChain = new Map<string, Promise<void>>();
function bumpImported(sb: Sb, channelId: string): Promise<void> {
  const next = (bumpChain.get(channelId) ?? Promise.resolve()).then(async () => {
    const { data: ch } = await sb.from("import_channels").select("imported_count").eq("id", channelId).maybeSingle();
    if (ch) await sb.from("import_channels").update({ imported_count: (ch.imported_count ?? 0) + 1, last_sync_timestamp: new Date().toISOString() }).eq("id", channelId);
  }).catch(() => {});
  bumpChain.set(channelId, next);
  return next;
}
