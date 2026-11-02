import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { normalizeProduct } from "./normalize";

export function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const listProducts = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const data: Parameters<typeof normalizeProduct>[0][] = [];
  // Paged: the database returns at most 1000 rows per request.
  for (let from = 0; ; from += 1000) {
    const { data: page, error } = await sb.from("products").select("*").order("pinned", { ascending: false }).order("created_at", { ascending: false }).order("id").range(from, from + 999);
    if (error) throw new Error(error.message);
    data.push(...((page ?? []) as typeof data));
    if (!page || page.length < 1000) break;
  }
  // List view only needs a few photos per colour; full galleries load on the product page.
  return data.map(normalizeProduct).map((p) => ({
    ...p,
    images: p.images.slice(0, 3),
    colors: p.colors.slice(0, 12).map((c) => ({ ...c, images: c.images.slice(0, 2) })),
  }));
});

export const getProduct = createServerFn({ method: "GET" })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { data, error } = await publicClient().from("products").select("*").eq(/^[0-9a-f-]{36}$/i.test(id) ? "id" : "slug", id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? normalizeProduct(data) : null;
  });

export const listCategories = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await publicClient().from("categories").select("id,label").eq("is_active", true).order("sort", { ascending: true }).order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});
