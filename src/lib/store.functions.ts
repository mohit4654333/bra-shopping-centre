import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { publicClient } from "./products.functions";

export const DEFAULT_SETTINGS = {
  brand_name: "Glamour Boutique", upi_id: "paytmqr5fd3tr@ptys", theme: "fashion",
  show_sizes: true, show_colors: true, buy_now: true, live_chat: true, offers_banner: true, announcement_bar: true,
  announcement_text: "Free delivery above ₹999 · Discreet packaging · Easy exchange",
  tagline: "Comfortable bras, panties and nightwear — every colour shown with its own photos.", upi_name: "",
  bg_image: "", bg_opacity: 8, show_bg: false,
  reviews_enabled: true, social_proof_enabled: true, review_approval: false, landing_layout: "boutique",
};
export type StoreSettings = typeof DEFAULT_SETTINGS;

export const getSettings = createServerFn({ method: "GET" }).handler(async (): Promise<StoreSettings> => {
  const { data } = await publicClient().from("store_settings").select("*").eq("id", 1).maybeSingle();
  if (!data) return DEFAULT_SETTINGS;
  const { id: _i, updated_at: _u, ...rest } = data;
  return { ...DEFAULT_SETTINGS, ...rest };
});
export const settingsQuery = queryOptions({ queryKey: ["settings"], queryFn: () => getSettings() });

export const listBanners = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await publicClient().from("banners").select("*").eq("active", true).order("sort");
  return data ?? [];
});
export const bannersQuery = queryOptions({ queryKey: ["banners"], queryFn: () => listBanners() });

const orderSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/),
  address: z.string().trim().min(10).max(300),
  pincode: z.string().trim().regex(/^\d{6}$/),
  items: z.array(z.object({ id: z.string().uuid(), qty: z.number().int().min(1).max(50), color: z.string().max(60), size: z.string().max(30) })).min(1).max(30),
});

export const placeOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => orderSchema.parse(d))
  .handler(async ({ data }) => {
    // Prices and totals are recomputed inside the database function.
    const { data: rows, error } = await publicClient().rpc("create_order", { _name: data.name, _phone: data.phone, _address: data.address, _pincode: data.pincode, _items: data.items });
    if (error || !rows?.[0]) { console.error(error); throw new Error(error?.message?.includes("no longer") ? "Your bag items are no longer available" : "Could not save order"); }
    return { id: rows[0].id as string, total: Number(rows[0].total) };
  });

export const trackOrders = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ phone: z.string().trim().regex(/^[6-9]\d{9}$/), code: z.string().trim().toLowerCase().regex(/^[0-9a-f-]{6,36}$/) }).parse(d))
  .handler(async ({ data }) => {
    const { data: rows, error } = await publicClient().rpc("track_orders", { _phone: data.phone, _code: data.code });
    if (error) { console.error(error); throw new Error("Abhi check nahi ho paya"); }
    return (rows ?? []).map((r) => ({ ...r, total: Number(r.total), items: r.items as { name: string; qty: number }[] }));
  });
