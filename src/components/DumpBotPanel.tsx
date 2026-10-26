import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DUMP_CATEGORIES, dumpPlan } from "@/lib/dumpbot";

/** Admin-only catalog seeder. All generation runs inside admin-only database functions. */
export function DumpBotPanel() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [msg, setMsg] = useState("Ready");
  const [total, setTotal] = useState(600);

  const refresh = () => qc.invalidateQueries();

  const seedCats = async () => {
    const { error } = await supabase.rpc("seed_categories");
    if (error) throw new Error(error.message);
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : "Something went wrong"); setMsg("Stopped"); }
    finally { setBusy(false); refresh(); }
  };

  const fullDump = () => run(async () => {
    setPct(2); setMsg("Seeding categories…");
    await seedCats();
    const steps = dumpPlan(total);
    let done = 0;
    for (const s of steps) {
      setMsg(`Seeding products… ${s.label} (${done}/${total})`);
      const { error } = await supabase.rpc("seed_catalog_category", { _cat: s.slug, _n: s.count });
      if (error) throw new Error(error.message);
      done += s.count;
      setPct(5 + Math.round((done / total) * 90));
    }
    setMsg("Linking multi-colour variants…"); setPct(98);
    setPct(100); setMsg(`Done! ${total} products added across ${DUMP_CATEGORIES.length} categories.`);
    toast.success(`${total} products added`);
  });

  const autoCats = () => run(async () => {
    setPct(30); setMsg("Creating categories…");
    await seedCats();
    setPct(100); setMsg("Done! Categories ready.");
    toast.success("Categories ready");
  });

  const clear = () => {
    if (!confirm("Delete ALL products and their colours? This cannot be undone.")) return;
    run(async () => {
      setPct(40); setMsg("Clearing catalog…");
      const { data, error } = await supabase.rpc("clear_catalog");
      if (error) throw new Error(error.message);
      setPct(100); setMsg(`Done! Removed ${data ?? 0} products.`);
    });
  };

  return (
    <section className="mb-6 rounded-xl border-2 border-primary/40 bg-card p-5">
      <h2 className="text-xl font-semibold">Autonomous Catalog Injector & Dump Bot</h2>
      <p className="mt-1 text-sm text-muted-foreground">Fills the store instantly with ready products in 8 categories, each with 3–4 colours and real band & cup sizes. Add model photos per colour from the product editor.</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm">Products
          <select value={total} disabled={busy} onChange={(e) => setTotal(Number(e.target.value))} className="rounded-md border bg-background px-2 py-1">
            {[200, 400, 600, 800, 1000].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <Button disabled={busy} onClick={fullDump}>🚀 1-Click Full Catalog Dump</Button>
        <Button disabled={busy} variant="secondary" onClick={autoCats}>🔄 Category Auto-Generator</Button>
        <Button disabled={busy} variant="destructive" onClick={clear}>⚠️ Clear Catalog</Button>
      </div>
      <div className="mt-4">
        <Progress value={pct} />
        <p className="mt-1 text-xs text-muted-foreground">{msg}</p>
      </div>
    </section>
  );
}
