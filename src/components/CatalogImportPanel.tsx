import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { fetchCatalogPage, saveCatalogItems } from "@/lib/catalog.functions";
import type { Category, ImportedProduct } from "@/lib/types";

type Item = ImportedProduct & { exists: boolean };

export function CatalogImportPanel({ categories }: { categories: Category[] }) {
  const qc = useQueryClient();
  const fetchPage = useServerFn(fetchCatalogPage);
  const save = useServerFn(saveCatalogItems);
  const [url, setUrl] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [cat, setCat] = useState("all");
  const [busy, setBusy] = useState("");
  const [prog, setProg] = useState({ done: 0, total: 0 });

  const label = (id: string) => categories.find((c) => c.id === id)?.label ?? id;

  async function load(reset: boolean) {
    if (!url.trim()) { toast.error("Paste a shop link first"); return; }
    const next = reset ? 1 : page + 1;
    setBusy("Reading catalogue…");
    try {
      const r = await fetchPage({ data: { url, page: next } });
      setItems((old) => {
        const base = reset ? [] : old;
        const seen = new Set(base.map((i) => i.source_url));
        return [...base, ...r.items.filter((i) => !seen.has(i.source_url))];
      });
      if (reset) setSel(new Set());
      setPage(next);
      setMore(r.more);
      toast.success(`${r.items.length} products found (${r.items.filter((i) => !i.exists).length} new)`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  const visible = items.filter((i) => cat === "all" || i.category === cat);
  const newOnes = visible.filter((i) => !i.exists);

  function selectNext(n: number) {
    setSel((s) => {
      const out = new Set(s);
      let added = 0;
      for (const i of newOnes) {
        if (added >= n) break;
        if (!out.has(i.source_url)) { out.add(i.source_url); added++; }
      }
      return out;
    });
  }
  function toggle(u: string) {
    setSel((s) => { const o = new Set(s); o.has(u) ? o.delete(u) : o.add(u); return o; });
  }

  async function importSelected() {
    const list = items.filter((i) => sel.has(i.source_url) && !i.exists);
    if (!list.length) { toast.error("Select some new products first"); return; }
    setBusy("Importing…");
    setProg({ done: 0, total: list.length });
    let saved = 0;
    const doneUrls = new Set<string>();
    for (let i = 0; i < list.length; i += 50) {
      const chunk = list.slice(i, i + 50);
      try {
        const r = await save({ data: { items: chunk.map(({ exists: _e, ...p }) => p) } });
        saved += r.saved;
        chunk.forEach((c) => doneUrls.add(c.source_url));
      } catch (e) {
        toast.error((e as Error).message);
      }
      setProg({ done: Math.min(i + 50, list.length), total: list.length });
    }
    setItems((old) => old.map((i) => (doneUrls.has(i.source_url) ? { ...i, exists: true } : i)));
    setSel(new Set());
    setBusy("");
    qc.invalidateQueries();
    toast.success(`${saved} products added to your store`);
  }

  return (
    <section className="mt-8 rounded-xl border bg-card p-5">
      <h2 className="text-xl font-semibold">1-Click Catalogue Import</h2>
      <p className="mt-1 text-sm text-muted-foreground">Paste a shop link (e.g. enamor.co.in, secretwish.in, bummer.in, dermawear.co.in). We load 250 products at a time with photos, colours, sizes and description. Products already in your store are marked and cannot be selected.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input placeholder="https://enamor.co.in" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(true)} />
        <Button onClick={() => load(true)} disabled={!!busy} className="sm:w-44">{busy === "Reading catalogue…" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load products"}</Button>
      </div>

      {items.length > 0 && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <select className="h-9 rounded-md border bg-background px-2" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="all">All categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <Button size="sm" variant="outline" onClick={() => selectNext(100)}>Select next 100</Button>
            <Button size="sm" variant="outline" onClick={() => selectNext(500)}>Select next 500</Button>
            <Button size="sm" variant="outline" onClick={() => selectNext(1000)}>Select next 1000</Button>
            <Button size="sm" variant="outline" onClick={() => selectNext(Infinity)}>Select all new</Button>
            <Button size="sm" variant="ghost" onClick={() => setSel(new Set())}>Clear</Button>
            {more && <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => load(false)}>Load 250 more</Button>}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{items.length} loaded · {items.filter((i) => !i.exists).length} new · {sel.size} selected</p>
          {busy === "Importing…" && (
            <div className="mt-3"><Progress value={(prog.done / Math.max(1, prog.total)) * 100} /><p className="mt-1 text-xs">Importing {prog.done}/{prog.total}…</p></div>
          )}
          <Button className="mt-3 w-full" disabled={!!busy || !sel.size} onClick={importSelected}>Import {sel.size} selected products</Button>
          <div className="mt-3 max-h-[480px] divide-y overflow-y-auto rounded-lg border">
            {visible.map((i) => (
              <label key={i.source_url} className={`flex items-center gap-3 p-2 ${i.exists ? "opacity-50" : "cursor-pointer"}`}>
                <input type="checkbox" disabled={i.exists} checked={!i.exists && sel.has(i.source_url)} onChange={() => toggle(i.source_url)} />
                <img src={i.images[0]} alt="" loading="lazy" className="h-14 w-11 rounded object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{i.name}</p>
                  <p className="text-xs text-muted-foreground">₹{i.price}{i.old_price > i.price ? ` · MRP ₹${i.old_price}` : ""} · {label(i.category)} · {i.colors.length} colours · {i.sizes.length} sizes</p>
                </div>
                {i.exists && <span className="text-xs font-medium">Already added</span>}
              </label>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
