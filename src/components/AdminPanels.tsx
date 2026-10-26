import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IndianRupee, Package, ShoppingCart, Trash2, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ORDER_STATUSES, orderStats, type OrderLine } from "@/lib/orders";
import { THEMES, LAYOUTS } from "@/lib/themes";
import { DEFAULT_SETTINGS, type StoreSettings } from "@/lib/store.functions";
import { rupees } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { firecrawlStatus, saveFirecrawlKey } from "@/lib/import.functions";

type Order = { id: string; customer_name: string; phone: string; address: string; pincode: string; items: OrderLine[]; total: number; status: string; created_at: string; tracking_no?: string };

const statusStyle: Record<string, string> = {
  pending: "bg-accent text-accent-foreground", dispatched: "bg-secondary text-secondary-foreground",
  delivered: "bg-success/15 text-success", cancelled: "bg-destructive/10 text-destructive",
};

function useOrders() {
  return useQuery({
    queryKey: ["admin-orders"],
    queryFn: async (): Promise<Order[]> => {
      const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Order[];
    },
  });
}

function StatusBadge({ s }: { s: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusStyle[s] ?? ""}`}>{s}</span>;
}

export function DashboardPanel({ productCount }: { productCount: number }) {
  const orders = useOrders();
  const st = orderStats(orders.data ?? []);
  const cards = [
    { label: "Total Orders", value: st.totalOrders, icon: ShoppingCart },
    { label: "Revenue", value: rupees(st.revenue), icon: IndianRupee },
    { label: "Total Products", value: productCount, icon: Package },
    { label: "Pending Deliveries", value: st.pending, icon: Truck },
  ];
  return (
    <div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border bg-card p-4">
            <c.icon className="h-5 w-5 text-primary" />
            <p className="mt-3 text-2xl font-bold">{c.value}</p>
            <p className="text-xs text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>
      <h3 className="mb-2 mt-8 text-lg font-semibold">Recent orders</h3>
      <div className="divide-y rounded-xl border bg-card">
        {(orders.data ?? []).slice(0, 8).map((o) => (
          <div key={o.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
            <div className="min-w-0 flex-1"><p className="font-medium">{o.customer_name} · {o.phone}</p><p className="truncate text-xs text-muted-foreground">{o.items.map((i) => `${i.name} ×${i.qty}`).join(", ")}</p></div>
            <span className="font-semibold">{rupees(Number(o.total))}</span>
            <StatusBadge s={o.status} />
          </div>
        ))}
        {orders.data?.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No orders yet.</p>}
      </div>
    </div>
  );
}

export function OrdersPanel() {
  const orders = useOrders();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const setTracking = async (id: string, tracking_no: string) => {
    const { error } = await supabase.from("orders").update({ tracking_no: tracking_no.trim() }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Tracking number save ho gaya");
  };
  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Order marked ${status}`);
    qc.invalidateQueries({ queryKey: ["admin-orders"] });
  };
  const list = (orders.data ?? []).filter((o) => filter === "all" || o.status === filter);
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {["all", ...ORDER_STATUSES].map((s) => (
          <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} className="capitalize" onClick={() => setFilter(s)}>{s}</Button>
        ))}
      </div>
      <div className="space-y-3">
        {list.map((o) => (
          <div key={o.id} className="rounded-xl border bg-card p-4 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <p className="font-semibold">#{o.id.slice(0, 8)}</p>
              <StatusBadge s={o.status} />
              <span className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("en-IN")}</span>
              <select value={o.status} onChange={(e) => setStatus(o.id, e.target.value)} className="ml-auto rounded-md border bg-card px-2 py-1 capitalize">
                {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div><p className="font-medium">{o.customer_name}</p><a href={`tel:${o.phone}`} className="text-primary">{o.phone}</a><p className="text-muted-foreground">{o.address} – {o.pincode}</p></div>
              <div>
                {o.items.map((i, k) => <p key={k}>{i.name} {[i.color, i.size].filter(Boolean).join(" / ")} × {i.qty} — {rupees(i.price * i.qty)}</p>)}
                <p className="mt-1 font-semibold">Total {rupees(Number(o.total))}</p>
                <input defaultValue={o.tracking_no ?? ""} placeholder="Courier tracking no. likhein" onBlur={(e) => e.target.value !== (o.tracking_no ?? "") && setTracking(o.id, e.target.value)} className="mt-2 w-full rounded-md border bg-card px-2 py-1 text-xs" />
              </div>
            </div>
          </div>
        ))}
        {list.length === 0 && <p className="py-10 text-center text-muted-foreground">No orders here.</p>}
      </div>
    </div>
  );
}

type Banner = { id: string; title: string; subtitle: string; image: string; link_type: string; link_value: string; sort: number; active: boolean };

export function BannersPanel({ products, categories }: { products: { id: string; name: string }[]; categories: { id: string; label: string }[] }) {
  const qc = useQueryClient();
  const banners = useQuery({
    queryKey: ["admin-banners"],
    queryFn: async (): Promise<Banner[]> => {
      const { data, error } = await supabase.from("banners").select("*").order("sort");
      if (error) throw error;
      return data;
    },
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-banners"] }); qc.invalidateQueries({ queryKey: ["banners"] }); };
  const add = async () => {
    const { error } = await supabase.from("banners").insert({ title: "New Offer", subtitle: "Limited time only", link_type: "category", link_value: "all", sort: (banners.data?.length ?? 0) + 1 });
    if (error) toast.error(error.message); else refresh();
  };
  return (
    <div className="space-y-3">
      {banners.data?.map((b) => <BannerRow key={b.id} b={b} products={products} categories={categories} onDone={refresh} />)}
      <Button onClick={add}>+ Add banner</Button>
    </div>
  );
}

function BannerRow({ b, products, categories, onDone }: { b: Banner; products: { id: string; name: string }[]; categories: { id: string; label: string }[]; onDone: () => void }) {
  const [d, setD] = useState(b);
  const [up, setUp] = useState(false);
  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUp(true);
    const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error } = await supabase.storage.from("banners").upload(path, file, { contentType: file.type });
    if (error) toast.error(error.message);
    else {
      const image = `/api/public/banner-img?p=${encodeURIComponent(path)}`;
      setD((p) => ({ ...p, image }));
      const { error: e2 } = await supabase.from("banners").update({ image }).eq("id", d.id);
      if (e2) toast.error(e2.message); else { toast.success("Photo uploaded & saved"); onDone(); }
    }
    setUp(false);
    e.target.value = "";
  };
  const save = async () => {
    const { id, ...rest } = d;
    const { error } = await supabase.from("banners").update(rest).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Banner saved"); onDone(); }
  };
  const del = async () => {
    if (!confirm("Delete this banner?")) return;
    const { error } = await supabase.from("banners").delete().eq("id", b.id);
    if (error) toast.error(error.message); else onDone();
  };
  return (
    <div className="grid gap-2 rounded-xl border bg-card p-4 md:grid-cols-2">
      <Input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="Title (e.g. Diwali Dhamaka)" />
      <Input value={d.subtitle} onChange={(e) => setD({ ...d, subtitle: e.target.value })} placeholder="Subtitle" />
      <div className="flex gap-2">
        <Input value={d.image} onChange={(e) => setD({ ...d, image: e.target.value })} placeholder="Background photo (optional)" className="min-w-0 flex-1" />
        <label className="inline-flex h-10 shrink-0 cursor-pointer items-center rounded-md border px-3 text-sm hover:bg-accent">
          {up ? "Uploading…" : "Upload photo"}
          <input type="file" accept="image/*" className="hidden" disabled={up} onChange={upload} />
        </label>
      </div>
      <div className="flex gap-2">
        <select value={d.link_type} onChange={(e) => setD({ ...d, link_type: e.target.value, link_value: e.target.value === "product" ? products[0]?.id ?? "" : "all" })} className="rounded-md border bg-card px-2 text-sm">
          <option value="category">Opens category</option><option value="product">Opens product</option>
        </select>
        <select value={d.link_value} onChange={(e) => setD({ ...d, link_value: e.target.value })} className="min-w-0 flex-1 rounded-md border bg-card px-2 text-sm">
          {d.link_type === "product"
            ? products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)
            : [{ id: "all", label: "All products" }, { id: "featured", label: "Featured" }, ...categories].map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-3 md:col-span-2">
        <label className="flex items-center gap-2 text-sm"><Switch checked={d.active} onCheckedChange={(v) => setD({ ...d, active: v })} /> Show</label>
        <label className="flex items-center gap-2 text-sm">Order <Input type="number" className="h-8 w-16" value={d.sort} onChange={(e) => setD({ ...d, sort: Number(e.target.value) })} /></label>
        <Button size="sm" className="ml-auto" onClick={save}>Save</Button>
        <Button size="icon" variant="ghost" aria-label="Delete banner" onClick={del}><Trash2 className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

type Chat = { id: string; session_id: string; customer_name: string; sender: string; body: string; created_at: string };

export function ChatPanel() {
  const [sel, setSel] = useState<string | null>(null);
  const [text, setText] = useState("");
  const chats = useQuery({
    queryKey: ["admin-chats"],
    refetchInterval: 5000,
    queryFn: async (): Promise<Chat[]> => {
      const { data, error } = await supabase.from("chat_messages").select("*").order("created_at").limit(1000);
      if (error) throw error;
      return data;
    },
  });
  const threads = new Map<string, Chat[]>();
  for (const m of chats.data ?? []) threads.set(m.session_id, [...(threads.get(m.session_id) ?? []), m]);
  const order = [...threads.entries()].sort((a, b) => (b[1].at(-1)!.created_at > a[1].at(-1)!.created_at ? 1 : -1));
  const current = sel ? threads.get(sel) ?? [] : [];
  const reply = async () => {
    if (!sel || !text.trim()) return;
    const { error } = await supabase.from("chat_messages").insert({ session_id: sel, sender: "admin", body: text.trim().slice(0, 1000) });
    if (error) { toast.error(error.message); return; }
    setText(""); chats.refetch();
  };
  return (
    <div className="grid h-[32rem] overflow-hidden rounded-xl border bg-card md:grid-cols-[16rem_1fr]">
      <div className="overflow-y-auto border-r">
        {order.map(([sid, ms]) => (
          <button key={sid} type="button" onClick={() => setSel(sid)} className={`block w-full border-b p-3 text-left text-sm ${sel === sid ? "bg-accent" : "hover:bg-muted"}`}>
            <p className="font-medium">{ms.find((m) => m.customer_name)?.customer_name || "Customer " + sid.slice(0, 4)}</p>
            <p className="truncate text-xs text-muted-foreground">{ms.at(-1)!.body}</p>
          </button>
        ))}
        {order.length === 0 && <p className="p-4 text-sm text-muted-foreground">No chats yet.</p>}
      </div>
      <div className="flex flex-col">
        <div className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
          {current.map((m) => <p key={m.id} className={`max-w-[75%] rounded-xl p-2 ${m.sender === "admin" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"}`}>{m.body}</p>)}
          {!sel && <p className="text-muted-foreground">Pick a chat on the left.</p>}
        </div>
        {sel && (
          <form className="flex gap-2 border-t p-2" onSubmit={(e) => { e.preventDefault(); reply(); }}>
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Reply…" /><Button type="submit">Send</Button>
          </form>
        )}
      </div>
    </div>
  );
}

export function SettingsPanel() {
  const qc = useQueryClient();
  const [s, setS] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [bgUp, setBgUp] = useState(false);
  const uploadBg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBgUp(true);
    const path = `bg-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error } = await supabase.storage.from("banners").upload(path, file, { contentType: file.type });
    setBgUp(false);
    e.target.value = "";
    if (error) { toast.error(error.message); return; }
    setS((p) => ({ ...p, bg_image: `/api/public/banner-img?p=${encodeURIComponent(path)}`, show_bg: true }));
    toast.success("Photo uploaded — ab Save settings dabayein");
  };
  useEffect(() => {
    supabase.from("store_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) { const { id: _i, updated_at: _u, ...rest } = data; setS({ ...DEFAULT_SETTINGS, ...rest }); }
    });
  }, []);
  const save = async () => {
    if (!s.brand_name.trim() || !/^[\w.\-]+@[\w.\-]+$/.test(s.upi_id.trim())) { toast.error("Enter a brand name and a valid UPI ID (name@bank)"); return; }
    setSaving(true);
    const { error } = await supabase.from("store_settings").update({ ...s, brand_name: s.brand_name.trim(), upi_id: s.upi_id.trim(), upi_name: s.upi_name.trim(), tagline: s.tagline.trim(), updated_at: new Date().toISOString() }).eq("id", 1);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Settings saved — store updated");
    qc.invalidateQueries({ queryKey: ["settings"] });
  };
  const toggles: [keyof StoreSettings, string, string][] = [
    ["show_sizes", "Sizes selection", "Turn off for Food / Grocery"],
    ["show_colors", "Colours selection", "Show colour swatches on product page"],
    ["buy_now", "Buy Now button", "Shows Buy Now next to Add to Bag on product page and cards"],
    ["live_chat", "Live Chat widget", "Floating chat bubble for customers"],
    ["offers_banner", "Offers Banner", "Sliding offers on the homepage"],
    ["announcement_bar", "Announcement Bar", "Thin strip above the header"],
    ["reviews_enabled", "Customer Reviews", "Product page par reviews aur review form"],
    ["social_proof_enabled", "Live order / review popup", "Asli recent orders aur 5★ reviews ka chhota popup (har 1-2 min)"],
  ];
  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card p-5">
        <h3 className="text-lg font-semibold">Business theme</h3>
        <select value={s.theme} onChange={(e) => setS({ ...s, theme: e.target.value })} className="mt-3 w-full rounded-md border bg-card px-3 py-2 text-sm">
          {THEMES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <div className="mt-3 flex flex-wrap gap-2">
          {THEMES.map((t) => (
            <button key={t.id} type="button" title={t.label} onClick={() => setS({ ...s, theme: t.id })} className={`h-8 w-8 rounded-full border-2 ${s.theme === t.id ? "border-foreground" : "border-transparent"}`} style={{ background: `oklch(${t.light} ${t.chroma} ${t.hue})` }} />
          ))}
        </div>
      </section>
      <section className="rounded-xl border bg-card p-5">
        <h3 className="text-lg font-semibold">Homepage design (Landing page)</h3>
        <p className="text-xs text-muted-foreground">Design chunein, phir neeche "Save settings" dabayein.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {LAYOUTS.map((l) => (
            <button key={l.id} type="button" onClick={() => setS({ ...s, landing_layout: l.id })} className={`rounded-lg border-2 p-3 text-left ${s.landing_layout === l.id ? "border-primary bg-accent" : "border-border"}`}>
              <div className="font-semibold">{l.label}</div>
              <div className="text-xs text-muted-foreground">{l.desc}</div>
            </button>
          ))}
        </div>
      </section>
      <section className="grid gap-3 rounded-xl border bg-card p-5 md:grid-cols-2">
        <h3 className="text-lg font-semibold md:col-span-2">Store details</h3>
        <label className="text-sm">Brand name<Input value={s.brand_name} onChange={(e) => setS({ ...s, brand_name: e.target.value })} /></label>
        <label className="text-sm">UPI ID<Input value={s.upi_id} onChange={(e) => setS({ ...s, upi_id: e.target.value })} /></label>
        <label className="text-sm">UPI name (shown in payment app)<Input value={s.upi_name} placeholder={s.brand_name} onChange={(e) => setS({ ...s, upi_name: e.target.value })} /></label>
        <label className="text-sm">Store tagline / subtitle<Input value={s.tagline} onChange={(e) => setS({ ...s, tagline: e.target.value })} /></label>
        <label className="text-sm md:col-span-2">Announcement text<Input value={s.announcement_text} onChange={(e) => setS({ ...s, announcement_text: e.target.value })} /></label>
      </section>
      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h3 className="text-lg font-semibold">Background photo (halki transparent)</h3>
        <label className="flex items-center gap-3">
          <span className="flex-1 text-sm">Show background photo</span>
          <span className="text-xs font-semibold">{s.show_bg ? "ON" : "OFF"}</span>
          <Switch checked={s.show_bg} onCheckedChange={(v) => setS({ ...s, show_bg: v })} />
        </label>
        {s.bg_image && <img src={s.bg_image} alt="" className="h-24 rounded-md object-cover" style={{ opacity: s.bg_opacity / 100 + 0.3 }} />}
        <input type="file" accept="image/*" disabled={bgUp} onChange={uploadBg} className="block text-sm" />
        {bgUp && <p className="text-xs">Uploading…</p>}
        <label className="block text-sm">Halkapan: {s.bg_opacity}%
          <input type="range" min={2} max={40} value={s.bg_opacity} onChange={(e) => setS({ ...s, bg_opacity: Number(e.target.value) })} className="w-full" />
        </label>
        <p className="text-xs text-muted-foreground">Photo upload ke baad "Save settings" dabayein.</p>
      </section>
      <section className="rounded-xl border bg-card p-5">
        <h3 className="text-lg font-semibold">Feature switches</h3>
        <div className="mt-3 divide-y">
          {toggles.map(([k, label, hint]) => (
            <label key={k} className="flex items-center gap-3 py-3">
              <div className="flex-1"><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{hint}</p></div>
              <span className="text-xs font-semibold">{s[k] ? "ON" : "OFF"}</span>
              <Switch checked={Boolean(s[k])} onCheckedChange={(v) => setS({ ...s, [k]: v })} />
            </label>
          ))}
        </div>
      </section>
      <Button size="lg" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button>
      <FirecrawlKeyBox />
    </div>
  );
}

function FirecrawlKeyBox() {
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { firecrawlStatus().then((r) => setSaved(r.saved)).catch(() => setSaved(false)); }, []);
  const save = async (value: string) => {
    setBusy(true);
    try {
      const r = await saveFirecrawlKey({ data: { key: value } });
      setSaved(r.saved); setKey("");
      toast.success(r.saved ? "Firecrawl key saved — import ab connected hai" : "Key hata di gayi");
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };
  return (
    <section className="space-y-3 rounded-xl border bg-card p-5">
      <h3 className="text-lg font-semibold">Firecrawl API Key (product import)</h3>
      <p className="text-sm">Status: <span className="font-semibold">{saved === null ? "…" : saved ? "✅ Connected" : "❌ Not connected"}</span></p>
      <Input type="password" value={key} placeholder="fc-xxxxxxxxxxxx" onChange={(e) => setKey(e.target.value)} autoComplete="off" />
      <div className="flex gap-2">
        <Button onClick={() => save(key)} disabled={busy || !key.trim()}>{busy ? "Saving…" : "Save key"}</Button>
        {saved && <Button variant="outline" onClick={() => save("")} disabled={busy}>Remove key</Button>}
      </div>
      <p className="text-xs text-muted-foreground">Key private rehti hai — sirf admin save kar sakta hai, kisi customer ko nahi dikhti.</p>
    </section>
  );
}
