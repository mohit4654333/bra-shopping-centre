import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canonicalUrl } from "./autoqueue";
import { firecrawlKey, importProduct, scanPages } from "./autopilot.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ctx = { supabase: any; userId: string };
async function assertAdmin(context: Ctx) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Only the store admin can do this");
}

/**
 * Scan a saved channel from the page after the last one scanned, collecting product links
 * until `count` NEW ones are found. Known links are rejected with one IN query per page — never opened.
 */
export const scanChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { channelId: string; count: number }) => ({ channelId: String(i.channelId), count: Math.max(1, Math.min(60, Math.floor(i.count || 10))) }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    const { data: ch, error } = await sb.from("import_channels").select("*").eq("id", data.channelId).single();
    if (error || !ch) throw new Error("Channel not found");
    const s = await scanPages(sb, ch.url, ch.last_scanned_page as number, data.count, await firecrawlKey(sb));
    const last = s.fresh.length || s.page > 1 ? s.page : ch.last_scanned_page;
    const remember = !s.fresh.length && s.ended ? 0 : s.fresh.length > data.count ? Math.max(0, last - 1) : last;
    await sb.from("import_channels").update({ last_scanned_page: remember, last_sync_timestamp: new Date().toISOString() }).eq("id", ch.id);
    return { urls: s.fresh.slice(0, data.count), skipped: s.skipped, page: last, category: ch.category as string };
  });

/** Import one product URL and save it live. Returns the saved name, or "duplicate" if it already exists. */
export const importAndSave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { url: string; category: string; channelId: string }) => {
    if (!/^https?:\/\//i.test(i.url)) throw new Error("Bad link");
    return { url: canonicalUrl(i.url), category: String(i.category || "other"), channelId: String(i.channelId) };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    return importProduct(context.supabase, data.url, data.category, await firecrawlKey(context.supabase), data.channelId);
  });
