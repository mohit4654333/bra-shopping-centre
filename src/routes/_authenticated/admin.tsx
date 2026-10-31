import { ReviewsPanel } from "@/components/ReviewsPanel";
import { AutoQueuePanel } from "@/components/AutoQueuePanel";
import { CatalogImportPanel } from "@/components/CatalogImportPanel";
import { DumpBotPanel } from "@/components/DumpBotPanel";
import { AiDesignerPanel } from "@/components/AiDesignerPanel";
import { ModelCatalogPanel } from "@/components/ModelCatalogPanel";
import { CategoryOrderPanel } from "@/components/CategoryOrderPanel";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Link2, Loader2, Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { importProduct } from "@/lib/import.functions";
import { normalizeProduct } from "@/lib/normalize";
import { CATEGORIES, STORE_BRAND, colorsMissingPhotos, coverImage, sanitizeImages, slugifyCategory, type Category, type ColorVariant, type ImportedProduct, type Product } from "@/lib/types";
import { colorNameToHex, isComboText } from "@/lib/extract";
import { AddCategoryButton, refreshCategories } from "@/components/AddCategoryButton";
import { cleanBrandText, cleanBrands } from "@/lib/brandwipe";
import { BulkPricingPanel } from "@/components/BulkPricingPanel";
import { rupees } from "@/lib/cart";
import { SafeImg } from "@/components/SafeImg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { BackButton } from "@/components/BackButton";
import { AdminPinCard } from "@/components/AdminPinCard";
import { BannersPanel, ChatPanel, DashboardPanel, OrdersPanel, SettingsPanel } from "@/components/AdminPanels";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Store Admin – Glamour Boutique" },
      { name: "description", content: "Import and manage boutique products from any link." },
      { property: "og:title", content: "Store Admin – Glamour Boutique" },
      { property: "og:description", content: "Manage products." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Draft = ImportedProduct & { id?: string; featured: boolean; badge: string };

const empty = (): Draft => ({
  name: "", brand: STORE_BRAND, category: "bra", price: 0, old_price: 0, description: "", highlights: [], specs: {},
  sizes: [], colors: [], images: [], source_url: "", featured: true, badge: "",
});

function AdminPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const runImport = useServerFn(importProduct);
  const role = useQuery({
    queryKey: ["is-admin", user.id],
    queryFn: async () => (await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" })).data === true,
  });
  const products = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("pinned", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;
      return data.map(normalizeProduct);
    },
  });
  const cats = useQuery({
    queryKey: ["admin-cats"],
    queryFn: async () => (await supabase.from("categories").select("id,label").order("sort").order("created_at")).data ?? [],
  });
  const [mode, setMode] = useState<"url" | "html">("url");
  const [combosOnly, setCombosOnly] = useState(false);
  const [limit, setLimit] = useState(24);
  const allProducts = products.data ?? [];
  const comboCount = allProducts.filter((p) => isComboText(p.name)).length;
  const shown = combosOnly ? allProducts.filter((p) => isComboText(p.name)) : allProducts;
  const changeCategory = async (p: Product, category: string) => {
    if (category === p.category) return;
    const { error } = await supabase.from("products").update({ category }).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Moved to ${(cats.data ?? []).find((c) => c.id === category)?.label ?? category}`);
    await qc.invalidateQueries({ queryKey: ["admin-products"] });
    qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0] ?? "").includes("product") });
  };
  const [url, setUrl] = useState("");
  const [html, setHtml] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);

  const doImport = async () => {
    if (mode === "url" && !url.trim()) { toast.error("Paste a product link first"); return; }
    if (mode === "html" && !html.trim()) { toast.error("Paste the page source first"); return; }
    setBusy(true);
    try {
      const r = await runImport({ data: mode === "url" ? { url } : { html, url } });
      setDraft({ ...r, featured: true, badge: "" });
      toast.success(`Found ${r.colors.length} colours, ${r.colors.reduce((n, c) => n + c.images.length, 0) || r.images.length} photos, ${r.sizes.length} sizes`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  const [sel, setSel] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const bulkRemove = async () => {
    const ids = [...sel];
    if (!ids.length || !confirm(`Delete ${ids.length} products? This cannot be undone.`)) return;
    setDeleting(true);
    const gone = new Set(ids);
    qc.setQueriesData({ queryKey: ["admin-products"] }, (old: unknown) => Array.isArray(old) ? old.filter((x: Product) => !gone.has(x.id)) : old);
    try {
      const all = products.data && ids.length >= products.data.length;
      if (all) {
        const { error } = await supabase.rpc("clear_catalog");
        if (error) throw error;
      } else {
        const parts: string[][] = [];
        for (let k = 0; k < ids.length; k += 200) parts.push(ids.slice(k, k + 200));
        const res = await Promise.all(parts.map((c) => supabase.from("products").delete().in("id", c)));
        const bad = res.find((r) => r.error);
        if (bad?.error) throw bad.error;
      }
      toast.success(`${ids.length} products deleted`);
      setSel(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
      qc.invalidateQueries();
    }
  };

  const remove = async (p: Product) => {
    if (!confirm(`Delete "${p.name}"?`)) return;
    qc.setQueriesData({ queryKey: ["admin-products"] }, (old: unknown) => Array.isArray(old) ? old.filter((x: Product) => x.id !== p.id) : old);
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) { toast.error(error.message); qc.invalidateQueries(); return; }
    toast.success("Deleted");
    qc.invalidateQueries();
  };

  if (role.isLoading) return <div className="py-24 text-center"><Loader2 className="mx-auto animate-spin" /></div>;
  if (!role.data) {
    return (
      <main className="mx-auto max-w-md py-24 text-center">
        <h1 className="text-2xl font-semibold">No admin access</h1>
        <p className="mt-2 text-sm text-muted-foreground">You are signed in as {user.email}, but this account is not the store admin.</p>
        <Button variant="outline" className="mt-6" onClick={() => supabase.auth.signOut()}>Sign out</Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4"><BackButton label="Back to Store" /></div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold">Store Admin</h1>
        <span className="text-sm text-muted-foreground">{user.email}</span>
        <Button asChild variant="outline" size="sm" className="ml-auto"><Link to="/admin/import">Import Products</Link></Button>
        <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>Sign out</Button>
      </div>

      <Tabs defaultValue="dashboard" className="mt-6">
        <TabsList className="flex h-auto flex-wrap">
          {[["dashboard", "Dashboard"], ["orders", "Orders"], ["products", "Products"], ["bulk-pricing", "Bulk Pricing"], ["banners", "Banners"], ["reviews", "Reviews"], ["chat", "Chat"], ["settings", "Settings"]].map(([t, l]) => <TabsTrigger key={t} value={t!}>{l}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="dashboard"><DashboardPanel productCount={products.data?.length ?? 0} /></TabsContent>
        <TabsContent value="orders"><OrdersPanel /></TabsContent>
        <TabsContent value="bulk-pricing"><BulkPricingPanel products={products.data ?? []} /></TabsContent>
        <TabsContent value="banners"><BannersPanel products={products.data ?? []} categories={cats.data ?? []} /></TabsContent>
        <TabsContent value="reviews"><ReviewsPanel products={products.data ?? []} /></TabsContent>
        <TabsContent value="chat"><ChatPanel /></TabsContent>
        <TabsContent value="settings"><AdminPinCard /><SettingsPanel /></TabsContent>
        <TabsContent value="products">
      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-xl font-semibold">Import product from any link</h2>
        <p className="mt-1 text-sm text-muted-foreground">Paste a product link from Zivame, Amazon, Myntra, Clovia, any Shopify store… We copy the name, price, MRP, description, sizes and every colour with all its model photos.</p>
        <div className="mt-4 flex gap-2">
          <Button size="sm" variant={mode === "url" ? "default" : "outline"} onClick={() => setMode("url")}>Product link</Button>
          <Button size="sm" variant={mode === "html" ? "default" : "outline"} onClick={() => setMode("html")}>Paste page source</Button>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setDraft(empty())}><Plus className="mr-1 h-4 w-4" />Add manually</Button>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="https://www.zivame.com/…" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doImport()} />
          </div>
          <Button onClick={doImport} disabled={busy} className="sm:w-48">{busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Reading page…</> : "Fetch details"}</Button>
        </div>
        {mode === "html" && (
          <Textarea className="mt-2 h-32 font-mono text-xs" placeholder="Open the product page → press Ctrl+U (or right-click → View page source) → Ctrl+A, Ctrl+C → paste here" value={html} onChange={(e) => setHtml(e.target.value)} />
        )}
        {busy && <p className="mt-2 text-xs text-muted-foreground">This can take 20–60 seconds for big shops — we are collecting every colour's photos.</p>}
      </section>

      <ModelCatalogPanel />
      <CategoryOrderPanel />
      <CatalogImportPanel categories={cats.data ?? []} />
      <AutoQueuePanel categories={cats.data ?? []} />


      <AiDesignerPanel />
      <DumpBotPanel />

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-xl font-semibold">Products ({shown.length}{combosOnly ? ` of ${allProducts.length}` : ""})</h2>
          <Button size="sm" variant={combosOnly ? "default" : "outline"} onClick={() => setCombosOnly((v) => !v)}>📦 Sets & Combos ({comboCount})</Button>
          <AddCategoryButton existing={cats.data ?? []} />
        </div>
        {!!products.data?.length && (
          <div className="sticky top-0 z-10 mb-2 flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" className="h-5 w-5 accent-primary" checked={sel.size > 0 && sel.size === products.data.length} onChange={(e) => setSel(e.target.checked ? new Set(products.data!.map((p) => p.id)) : new Set())} />
              Select all
            </label>
            <span className="text-sm text-muted-foreground">{sel.size} selected</span>
            {sel.size > 0 && <Button size="sm" variant="ghost" onClick={() => setSel(new Set())}>Clear</Button>}
            <Button size="sm" variant="destructive" className="ml-auto" disabled={!sel.size || deleting} onClick={bulkRemove}>
              {deleting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1 h-4 w-4" />}Delete {sel.size} selected
            </Button>
          </div>
        )}
        <div className="divide-y rounded-xl border bg-card">
          {combosOnly && !shown.length && <p className="p-4 text-sm text-muted-foreground">No sets or combo packs found.</p>}
          {shown.slice(0, limit).map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-3">
              <input type="checkbox" aria-label={`Select ${p.name}`} className="h-5 w-5 shrink-0 accent-primary" checked={sel.has(p.id)} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })} />
              <SafeImg src={coverImage(p)} className="h-16 w-12 rounded object-cover" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium"><span className="truncate">{p.name}</span>{isComboText(p.name) && <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">✨ Combo/Set</span>}</p>
                <p className="text-xs text-muted-foreground">{rupees(p.price)} · {p.colors.length} colours · {p.colors.reduce((n, c) => n + c.images.length, 0) || p.images.length} photos · {p.sizes.length} sizes</p>
              </div>
              <select aria-label={`Category for ${p.name}`} className="h-9 max-w-36 rounded-md border bg-background px-2 text-sm" value={p.category} onChange={(e) => changeCategory(p, e.target.value)}>
                {!(cats.data ?? []).some((c) => c.id === p.category) && <option value={p.category}>{p.category}</option>}
                {(cats.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <Button size="sm" variant={p.pinned ? "default" : "outline"} aria-label={p.pinned ? "Unpin" : "Pin to top"} onClick={async () => { const { error } = await supabase.from("products").update({ pinned: !p.pinned }).eq("id", p.id); if (error) toast.error(error.message); else { toast.success(p.pinned ? "Unpinned" : "📌 Pinned to top"); qc.invalidateQueries(); } }}>📌</Button>
              <Button size="sm" variant="outline" onClick={() => setDraft({ ...p })}>Edit</Button>
              <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => remove(p)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
        {shown.length > limit && <Button variant="outline" className="mt-3 w-full" onClick={() => setLimit((l) => l + 24)}>Aur dekhein ({shown.length - limit} left)</Button>}
      </section>
        </TabsContent>
      </Tabs>

      {draft && <Editor draft={draft} onClose={() => setDraft(null)} onSaved={() => { setDraft(null); setUrl(""); setHtml(""); qc.invalidateQueries(); }} />}
    </main>
  );
}

function ImageList({ images, onChange, onBroken }: { images: string[]; onChange: (v: string[]) => void; onBroken?: (u: string) => void }) {
  const [add, setAdd] = useState("");
  const [up, setUp] = useState(false);
  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])];
    if (!files.length) return;
    setUp(true);
    const urls: string[] = [];
    for (const file of files) {
      const path = `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { error } = await supabase.storage.from("banners").upload(path, file, { contentType: file.type });
      if (error) toast.error(error.message);
      else urls.push(`/api/public/banner-img?p=${encodeURIComponent(path)}`);
    }
    if (urls.length) { onChange([...images, ...urls]); toast.success(`${urls.length} photo added — ab "Save product" dabayein`); }
    setUp(false);
    e.target.value = "";
  };
  const move = (i: number, d: number) => {
    const n = [...images];
    const j = i + d;
    if (j < 0 || j >= n.length) return;
    const a = n[i]!; n[i] = n[j]!; n[j] = a;
    onChange(n);
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {images.map((u, i) => (
          <div key={u + i} className="group relative">
            <SafeImg src={u} className="h-24 w-18 rounded border object-cover" style={{ width: 72 }} onFail={onBroken} />
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-foreground/60 opacity-0 group-hover:opacity-100">
              <button type="button" aria-label="Move left" onClick={() => move(i, -1)} className="p-0.5 text-background"><ArrowUp className="h-3 w-3 -rotate-90" /></button>
              <button type="button" aria-label="Remove" onClick={() => onChange(images.filter((_, k) => k !== i))} className="p-0.5 text-background"><X className="h-3 w-3" /></button>
              <button type="button" aria-label="Move right" onClick={() => move(i, 1)} className="p-0.5 text-background"><ArrowDown className="h-3 w-3 -rotate-90" /></button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <label className="inline-flex h-8 cursor-pointer items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground">
          {up ? "Uploading…" : "📷 Upload photos"}
          <input type="file" accept="image/*" multiple className="hidden" disabled={up} onChange={upload} />
        </label>
        <Input placeholder="or paste photo link" value={add} onChange={(e) => setAdd(e.target.value)} className="h-8 min-w-0 flex-1 text-xs" />
        <Button type="button" size="sm" variant="outline" onClick={() => { if (add.trim()) { onChange([...images, ...add.split(/\s+/).filter(Boolean)]); setAdd(""); } }}>Add</Button>
      </div>
    </div>
  );
}

function Editor({ draft, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(draft);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase.from("categories").select("id,label").order("sort").order("created_at", { ascending: true });
      if (error) throw error;
      return data.length ? data : CATEGORIES;
    },
  });
  const catList = cats.data ?? CATEGORIES;
  const options = catList.some((c) => c.id === d.category) || !d.category ? catList : [...catList, { id: d.category, label: d.category }];
  const [newCat, setNewCat] = useState<string | null>(null);
  const addCategory = async () => {
    const label = (newCat ?? "").trim();
    const id = slugifyCategory(label);
    if (!id) { toast.error("Type a category name"); return; }
    const existing = catList.find((c) => c.id === id || c.label.toLowerCase() === label.toLowerCase());
    if (!existing) {
      const { error } = await supabase.from("categories").insert({ id, label, slug: id });
      if (error) { toast.error(error.message); return; }
      toast.success(`Category "${label}" added`);
      await refreshCategories(qc);
    }
    set("category", existing?.id ?? id);
    setNewCat(null);
  };
  // Remove a photo that failed to load from every list it appears in.
  const dropBroken = (u: string) => setD((x) => ({
    ...x,
    images: x.images.filter((i) => i !== u),
    colors: x.colors.map((c) => ({ ...c, images: c.images.filter((i) => i !== u) })),
  }));
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const setColor = (i: number, c: Partial<ColorVariant>) => set("colors", d.colors.map((x, k) => (k === i ? { ...x, ...c } : x)));

  const save = async () => {
    if (!d.name.trim()) { toast.error("Name is required"); return; }
    const short = colorsMissingPhotos(d.colors.filter((c) => c.name.trim()));
    if (short.length) { toast.error(`Har colour mein kam se kam 3 photos chahiye: ${short.join(", ")}`); return; }
    setSaving(true);
    // Competitor names, "buy on X" text and manufacturer codes are wiped on every manual save too.
    const w = cleanBrands({ ...d, highlights: d.highlights.filter(Boolean), colors: d.colors.filter((c) => c.name.trim()) }, STORE_BRAND);
    const row = {
      name: w.name, brand: w.brand, category: d.category, price: d.price, old_price: d.old_price,
      description: w.description, highlights: w.highlights, specs: w.specs, badge: cleanBrandText(d.badge, STORE_BRAND),
      sizes: d.sizes,
      colors: w.colors.map((c) => ({ ...c, images: sanitizeImages(c.images) })),
      images: sanitizeImages(d.images), source_url: d.source_url, featured: d.featured,
    };
    const { error } = d.id ? await supabase.from("products").update(row).eq("id", d.id) : await supabase.from("products").insert(row);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Product saved");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display text-2xl">{d.id ? "Edit product" : "Review & save product"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2 text-sm">Name<Input value={d.name} onChange={(e) => set("name", e.target.value)} /></label>
          <label className="text-sm">Brand<Input value={d.brand} onChange={(e) => set("brand", e.target.value)} /></label>
          <div className="text-sm">
            <div className="flex items-center justify-between">Category
              <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setNewCat(newCat === null ? "" : null)}>+ New category</button>
            </div>
            {newCat === null ? (
              <select className="mt-0 h-9 w-full rounded-md border bg-background px-2 text-sm" value={d.category} onChange={(e) => set("category", e.target.value)}>
                {options.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            ) : (
              <div className="flex gap-1">
                <Input autoFocus placeholder="e.g. Bridal Sets" value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addCategory(); } }} />
                <Button type="button" size="sm" onClick={() => void addCategory()}>Add</Button>
                <Button type="button" size="icon" variant="ghost" aria-label="Cancel" onClick={() => setNewCat(null)}><X className="h-4 w-4" /></Button>
              </div>
            )}
          </div>
          <label className="text-sm">Selling price (₹)<Input type="number" value={d.price} onChange={(e) => set("price", Number(e.target.value))} /></label>
          <label className="text-sm">MRP (₹)<Input type="number" value={d.old_price} onChange={(e) => set("old_price", Number(e.target.value))} /></label>
          <label className="text-sm">Badge<Input placeholder="New, Bestseller…" value={d.badge} onChange={(e) => set("badge", e.target.value)} /></label>
          <label className="flex items-center gap-2 text-sm"><Switch checked={d.featured} onCheckedChange={(v) => set("featured", v)} />Show in Featured</label>
          <label className="sm:col-span-2 text-sm">Sizes (comma separated)<Input value={d.sizes.join(", ")} onChange={(e) => set("sizes", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} /></label>
          <label className="sm:col-span-2 text-sm">Description<Textarea rows={4} value={d.description} onChange={(e) => set("description", e.target.value)} /></label>
          <label className="text-sm">Highlights (one per line)<Textarea rows={4} value={d.highlights.join("\n")} onChange={(e) => set("highlights", e.target.value.split("\n"))} /></label>
          <label className="text-sm">Specifications (Key: Value per line)
            <Textarea rows={4} value={Object.entries(d.specs).map(([k, v]) => `${k}: ${v}`).join("\n")}
              onChange={(e) => set("specs", Object.fromEntries(e.target.value.split("\n").map((l) => l.split(/:(.*)/s)).filter((p) => p[0]?.trim()).map((p) => [(p[0] ?? "").trim(), (p[1] ?? "").trim()])))} />
          </label>
        </div>

        <div className="mt-4">
          <div className="flex items-center"><h3 className="text-lg font-semibold">Colours & their photos ({d.colors.length})</h3>
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => set("colors", [...d.colors, { name: "", hex: "#c71585", images: [] }])}><Plus className="mr-1 h-4 w-4" />Add colour</Button>
          </div>
          <p className="text-xs text-muted-foreground">When a customer clicks a colour, exactly these photos are shown.</p>
          <div className="mt-2 space-y-3">
            {d.colors.map((c, i) => (
              <div key={i} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <input type="color" value={c.hex} onChange={(e) => setColor(i, { hex: e.target.value })} className="h-8 w-8 rounded" aria-label="Colour" />
                  <Input className="h-8" placeholder="Colour name" value={c.name} onChange={(e) => setColor(i, { name: e.target.value, hex: c.hex === "#c71585" ? colorNameToHex(e.target.value) : c.hex })} />
                  <span className={`whitespace-nowrap text-xs ${c.images.length < 3 ? "font-semibold text-destructive" : "text-muted-foreground"}`}>{c.images.length} photos{c.images.length < 3 ? " (min 3)" : ""}</span>
                  <Button size="icon" variant="ghost" aria-label="Remove colour" onClick={() => set("colors", d.colors.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4" /></Button>
                </div>
                <ImageList images={c.images} onChange={(v) => setColor(i, { images: v })} onBroken={dropBroken} />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <h3 className="mb-2 text-lg font-semibold">All product photos ({d.images.length})</h3>
          <ImageList images={d.images} onChange={(v) => set("images", v)} onBroken={dropBroken} />
        </div>

        <div className="sticky bottom-0 mt-4 flex justify-end gap-2 bg-background pt-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save product"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
