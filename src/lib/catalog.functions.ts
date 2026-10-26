import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { feedOrigin, feedToProduct, mergeColorSiblings, type FeedProduct } from "./catalog";
import type { ImportedProduct } from "./types";

type Ctx = { supabase: any; userId: string };
async function assertAdmin(context: Ctx) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Only the store admin can do this");
}

/** Read one page (250 items) of a store's product feed and mark items already in the store. */
export const fetchCatalogPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { url: string; page: number }) => ({ url: String(i.url), page: Math.max(1, Math.floor(i.page || 1)) }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const origin = feedOrigin(data.url);
    let res: Response | null = null;
    for (let t = 0; t < 3; t++) {
      res = await fetch(`${origin}/products.json?limit=250&page=${data.page}`, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" } });
      if (res.status !== 429) break;
      await new Promise((r) => setTimeout(r, 2000 * (t + 1)));
    }
    if (!res || !res.ok) throw new Error(`This shop did not share its catalogue (error ${res?.status ?? "?"}). Try another link.`);
    const json = (await res.json().catch(() => null)) as { products?: FeedProduct[] } | null;
    if (!json?.products) throw new Error("This link has no open catalogue. Try another shop.");
    const { data: cats } = await context.supabase.from("categories").select("id");
    const known = ((cats ?? []) as { id: string }[]).map((c) => c.id);
    const items = mergeColorSiblings(json.products.map((p) => feedToProduct(p, origin, known)).filter((p): p is ImportedProduct => !!p));
    const urls = items.map((i) => i.source_url);
    const existing = new Set<string>();
    for (let i = 0; i < urls.length; i += 100) {
      const { data: rows } = await context.supabase.from("products").select("source_url").in("source_url", urls.slice(i, i + 100));
      for (const r of rows ?? []) existing.add(r.source_url);
    }
    return { items: items.map((p) => ({ ...p, exists: existing.has(p.source_url) })), more: json.products.length >= 250 };
  });

/** Save selected catalogue items, skipping any link already in the store. */
export const saveCatalogItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { items: ImportedProduct[] }) => ({ items: (i.items ?? []).slice(0, 100) }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const urls = data.items.map((i) => i.source_url);
    const { data: rows } = await context.supabase.from("products").select("source_url").in("source_url", urls);
    const have = new Set(((rows ?? []) as { source_url: string }[]).map((r) => r.source_url));
    const fresh = data.items.filter((i) => !have.has(i.source_url)).map((i) => ({
      name: i.name, brand: i.brand, category: i.category, price: i.price, old_price: i.old_price,
      description: i.description, highlights: i.highlights, specs: i.specs, sizes: i.sizes,
      colors: i.colors, images: i.images, source_url: i.source_url,
    }));
    if (fresh.length) {
      const { error } = await context.supabase.from("products").insert(fresh);
      if (error) throw new Error(error.message);
    }
    return { saved: fresh.length, skipped: data.items.length - fresh.length };
  });
