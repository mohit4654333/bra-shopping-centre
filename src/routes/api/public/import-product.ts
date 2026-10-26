import { createFileRoute } from "@tanstack/react-router";
import { STORE_BRAND, colorsMissingPhotos, sanitizeImages } from "@/lib/types";

// External product import. Caller sends `Authorization: Bearer <IMPORT_API_TOKEN>` and body `{ "url": "..." }`.
// Fetches the product page, saves it active + featured (same source_url → update).
// If fetching takes > 60s the caller gets 202 + job_id; poll with GET ?job_id=...
const json = (body: unknown, status = 200) => Response.json(body, { status });
const SYNC_LIMIT_MS = 60000;

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function authorized(request: Request) {
  const token = process.env["IMPORT_API_TOKEN"] ?? "";
  const auth = request.headers.get("authorization") ?? "";
  return !!token && safeEqual(auth.replace(/^Bearer\s*/i, ""), token);
}

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

type Job = { url: string; status: "processing" | "active" | "failed"; product_id?: string; action?: string; error?: string; started: number };

async function saveJob(id: string, job: Job) {
  const db = await admin();
  await db.from("app_secrets").upsert({ name: `import_job:${id}`, value: JSON.stringify(job), updated_at: new Date().toISOString() });
}

async function readJob(id: string): Promise<Job | null> {
  const db = await admin();
  const { data } = await db.from("app_secrets").select("value").eq("name", `import_job:${id}`).maybeSingle();
  try { return data ? (JSON.parse(data.value) as Job) : null; } catch { return null; }
}

/** Fetch + save as draft (or update existing by source_url), then publish after a short delay. */
async function importAndSave(url: string) {
  const db = await admin();
  const { runImport } = await import("@/lib/import.server");
  const { data: fc } = await db.from("app_secrets").select("value").eq("name", "firecrawl").maybeSingle();
  const p = await runImport(url, "", (fc?.value as string) || "");

  const images = sanitizeImages(p.images);
  if (!p.name || !p.price) throw new Error("Product name or price not found on that page");
  const short = colorsMissingPhotos(p.colors);
  if (short.length) throw new Error("Colours without 3 photos: " + short.join(", "));
  const old_price = p.old_price > p.price ? p.old_price : 0;
  const discount = old_price ? Math.round(((old_price - p.price) / old_price) * 100) : 0;
  const row = {
    name: p.name.slice(0, 200), brand: STORE_BRAND, category: p.category, price: p.price,
    old_price, description: p.description, highlights: p.highlights,
    specs: p.specs as never, sizes: p.sizes,
    colors: p.colors.map((c) => ({ ...c, images: sanitizeImages(c.images) })) as never,
    images, source_url: url, badge: discount >= 5 ? `${discount}% OFF` : "", featured: true,
  };

  // Saved active straight away so it shows on the homepage; same link updates the existing product.
  const { data: existing } = await db.from("products").select("id").eq("source_url", url).limit(1).maybeSingle();
  const res = existing
    ? await db.from("products").update(row).eq("id", existing.id).select("id").single()
    : await db.from("products").insert(row).select("id").single();
  if (res.error || !res.data) throw new Error("Could not save product: " + (res.error?.message ?? "unknown"));
  return {
    product_id: res.data.id, action: existing ? "updated" : "created", name: row.name, price: row.price, mrp: old_price, discount,
    colors: p.colors.map((c) => c.name), sizes: p.sizes, photos: images.length,
  };
}

export const Route = createFileRoute("/api/public/import-product")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!authorized(request)) return json({ error: "Unauthorized" }, 401);
        const id = new URL(request.url).searchParams.get("job_id") ?? "";
        if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "job_id required" }, 400);
        const job = await readJob(id);
        if (!job) return json({ error: "Job not found" }, 404);
        return json({ job_id: id, ...job });
      },
      POST: async ({ request }) => {
        if (!authorized(request)) return json({ error: "Unauthorized" }, 401);

        let b: Record<string, unknown>;
        try { b = (await request.json()) as Record<string, unknown>; } catch { return json({ error: "Invalid JSON body. Send { \"url\": \"https://...\" }" }, 400); }
        const raw = typeof b["url"] === "string" ? b["url"].trim() : "";
        let url: string;
        try {
          const u = new URL(raw);
          if (!/^https?:$/.test(u.protocol)) throw new Error();
          url = u.toString();
        } catch { return json({ error: "Valid product url required, e.g. { \"url\": \"https://...\" }" }, 400); }

        const jobId = crypto.randomUUID();
        const work = importAndSave(url)
          .then(async (r) => { await saveJob(jobId, { url, status: "active", product_id: r.product_id, action: r.action, started: Date.now() }).catch(() => {}); return r; })
          .catch(async (e: Error) => { await saveJob(jobId, { url, status: "failed", error: e.message, started: Date.now() }).catch(() => {}); throw e; });

        const timer = new Promise<"timeout">((r) => setTimeout(() => r("timeout"), SYNC_LIMIT_MS));
        try {
          const out = await Promise.race([work, timer]);
          if (out === "timeout") {
            await saveJob(jobId, { url, status: "processing", started: Date.now() });
            return json({ ok: true, status: "processing", job_id: jobId, message: "Import is taking longer than 60s. Check with GET ?job_id=" + jobId }, 202);
          }
          return json({ ok: true, status: "active", ...out }, out.action === "created" ? 201 : 200);
        } catch (e) {
          return json({ ok: false, error: (e as Error).message || "Import failed" }, 422);
        }
      },
    },
  },
});
