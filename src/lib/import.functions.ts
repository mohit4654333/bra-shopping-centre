import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runImport } from "./import.server";

type Ctx = { supabase: any; userId: string };
async function assertAdmin(context: Ctx) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!isAdmin) throw new Error("Only the store admin can do this");
}

export const importProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { url?: string; html?: string }) => {
    const url = (input.url ?? "").trim();
    const html = (input.html ?? "").slice(0, 4_000_000);
    if (!url && !html) throw new Error("Paste a product link or page source");
    if (url && !/^https?:\/\//i.test(url)) throw new Error("Link must start with http:// or https://");
    return { url, html };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row } = await (context.supabase as any).from("app_secrets").select("value").eq("name", "firecrawl").maybeSingle();
    return runImport(data.url, data.html, (row?.value as string) || "");
  });

/** Tells the admin whether a Firecrawl key is saved — never returns the key itself. */
export const firecrawlStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data: row } = await (context.supabase as any).from("app_secrets").select("value").eq("name", "firecrawl").maybeSingle();
    return { saved: !!row?.value };
  });

export const saveFirecrawlKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { key: string }) => {
    const key = (input.key ?? "").trim();
    if (key && !/^fc-[A-Za-z0-9]{8,}$/.test(key)) throw new Error("Key 'fc-' se shuru honi chahiye");
    return { key };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase as any).from("app_secrets").upsert({ name: "firecrawl", value: data.key, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { saved: !!data.key };
  });
