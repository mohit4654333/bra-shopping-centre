import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { dedupeKey, parseFile, planImport, type ImportPlan } from "@/lib/fileImport";

export const Route = createFileRoute("/_authenticated/admin_/import")({
  head: () => ({
    meta: [
      { title: "Import Products – Glamour Boutique Admin" },
      { name: "description", content: "Bulk import products from CSV or JSON files with duplicate protection." },
      { property: "og:title", content: "Import Products – Glamour Boutique Admin" },
      { property: "og:description", content: "Bulk CSV/JSON product importer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ImportPage,
});

/** Every existing product's duplicate key (paged so large catalogs are fully checked). */
async function loadExistingKeys(): Promise<Set<string>> {
  const keys = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("products").select("source_url").range(from, from + 999);
    if (error) throw error;
    for (const r of data ?? []) { const k = dedupeKey(r.source_url ?? ""); if (k) keys.add(k); }
    if (!data || data.length < 1000) break;
  }
  return keys;
}

function ImportPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const role = useQuery({
    queryKey: ["is-admin", user.id],
    queryFn: async () => (await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" })).data === true,
  });
  const [fileName, setFileName] = useState("");
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [saved, setSaved] = useState<number | null>(null);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true); setPlan(null); setSaved(null); setDone(0); setFileName(f.name);
    try {
      const rows = parseFile(f.name, await f.text());
      if (!rows.length) throw new Error("No products found in this file");
      const [keys, cats] = await Promise.all([loadExistingKeys(), supabase.from("categories").select("id")]);
      setPlan(planImport(rows, keys, (cats.data ?? []).map((c) => c.id)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read file");
    } finally { setBusy(false); }
  };

  const save = async () => {
    if (!plan) return;
    setBusy(true); setDone(0);
    try {
      // Re-check right before saving so nothing added meanwhile gets duplicated.
      const keys = await loadExistingKeys();
      const todo = plan.fresh.filter((m) => !keys.has(m.key));
      let n = 0;
      for (let i = 0; i < todo.length; i += 50) {
        const batch = todo.slice(i, i + 50).map((m) => ({ ...m.product, featured: false, badge: "" }));
        const { error } = await supabase.from("products").insert(batch);
        if (error) throw error;
        n += batch.length;
        setDone(n);
      }
      setSaved(n);
      toast.success(`${n} new products added to the store`);
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally { setBusy(false); }
  };

  if (role.isLoading) return <div className="py-24 text-center"><Loader2 className="mx-auto animate-spin" /></div>;
  if (!role.data) return <main className="mx-auto max-w-md py-24 text-center"><h1 className="text-2xl font-semibold">No admin access</h1></main>;

  const total = plan?.fresh.length ?? 0;
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link to="/admin" className="text-sm text-muted-foreground hover:underline">← Back to Admin</Link>
      <h1 className="mt-3 text-3xl font-semibold">Import Products</h1>
      <p className="mt-1 text-sm text-muted-foreground">Upload a .csv or .json export (Apify, Zivame, etc.). Existing products are skipped automatically.</p>

      <label className="mt-6 flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-8 text-center hover:bg-accent">
        <FileUp className="h-8 w-8 text-primary" />
        <span className="font-medium">{fileName || "Tap to choose a CSV or JSON file"}</span>
        <span className="text-xs text-muted-foreground">Works from phone storage too</span>
        <input type="file" accept=".csv,.json,.jsonl,text/csv,application/json" className="hidden" disabled={busy} onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
      </label>

      {busy && !plan && <div className="mt-6 flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Reading file and checking for duplicates…</div>}

      {plan && (
        <section className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total scanned in file" value={plan.total} />
            <Stat label="New products to add" value={plan.fresh.length} accent />
            <Stat label="Duplicates skipped" value={plan.duplicates.length} />
            <Stat label="Invalid rows skipped" value={plan.invalid.length} />
          </div>

          {saved === null ? (
            <Button size="lg" className="w-full bg-success text-success-foreground hover:bg-success/90 sm:w-auto" disabled={busy || !total} onClick={save}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Confirm & Save to Store ({total})
            </Button>
          ) : (
            <p className="flex items-center gap-2 font-medium text-success"><CheckCircle2 className="h-5 w-5" /> {saved} products saved.</p>
          )}
          {busy && total > 0 && <div><Progress value={(done / total) * 100} /><p className="mt-1 text-xs text-muted-foreground">{done} / {total} saved</p></div>}

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left"><tr><th className="p-2">Photo</th><th className="p-2">Title</th><th className="p-2">Price</th><th className="p-2">Category</th><th className="p-2">Photos</th><th className="p-2">Status</th></tr></thead>
              <tbody>
                {[...plan.fresh.map((m) => ({ m, s: "New" })), ...plan.duplicates.map((m) => ({ m, s: "Duplicate" })), ...plan.invalid.map((m) => ({ m, s: m.problem! }))].slice(0, 100).map(({ m, s }, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="p-2">{m.product.images[0] ? <img src={m.product.images[0]} alt="" className="h-12 w-10 rounded object-cover" loading="lazy" /> : "—"}</td>
                    <td className="max-w-xs truncate p-2">{m.product.name || "—"}</td>
                    <td className="whitespace-nowrap p-2">₹{m.product.price}{m.product.old_price > m.product.price && <span className="ml-1 text-xs text-muted-foreground line-through">₹{m.product.old_price}</span>}</td>
                    <td className="p-2">{m.product.category}</td>
                    <td className="p-2">{m.product.images.length}</td>
                    <td className={`p-2 font-medium ${s === "New" ? "text-success" : "text-muted-foreground"}`}>{s}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {plan.total > 100 && <p className="text-xs text-muted-foreground">Showing first 100 rows.</p>}
        </section>
      )}
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className={`text-2xl font-semibold ${accent ? "text-success" : ""}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
