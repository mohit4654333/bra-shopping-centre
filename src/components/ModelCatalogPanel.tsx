import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BATCHES, MODEL_CATS, chunks, seedPhotos } from "@/lib/modelCatalog";

/** 1-click catalog loader: clones real photos of products already imported into the store, 7-9 colours, full sizes. */
export function ModelCatalogPanel() {
  const qc = useQueryClient();
  const [cat, setCat] = useState("all");
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState(0);
  const [done, setDone] = useState(0);
  const stop = useRef(false);

  const load = async (count: number) => {
    setBusy(true); setTarget(count); setDone(0); stop.current = false;
    let made = 0;
    try {
      for (const n of chunks(count)) {
        if (stop.current) break;
        const { data, error } = await supabase.rpc("seed_model_catalog", { _cat: cat, _n: n, _photos: seedPhotos() });
        if (error) throw new Error(error.message);
        made += Number(data ?? n);
        setDone(made);
      }
      toast.success(`${made} products added`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setBusy(false);
      qc.invalidateQueries();
    }
  };

  const clearDummy = async () => {
    if (!confirm("Mannequin wale saare dummy products delete karein?")) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("clear_model_seed");
    setBusy(false);
    if (error) toast.error(error.message); else toast.success(`${data ?? 0} dummy products hata diye`);
    qc.invalidateQueries();
  };

  return (
    <section className="mt-6 rounded-xl border bg-card p-5">
      <h2 className="text-xl font-semibold">📸 Instant Model Catalog Loader</h2>
      <p className="mt-1 text-sm text-muted-foreground">1 click me products — 7-9 colours, poori size range. Store me imported products hon to unki real photos lagengi, warna default photo.</p>
      <select aria-label="Category" className="mt-4 h-9 w-full max-w-md rounded-md border bg-background px-2 text-sm" value={cat} onChange={(e) => setCat(e.target.value)} disabled={busy}>
        {MODEL_CATS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <div className="mt-3 flex flex-wrap gap-2">
        {BATCHES.map((c) => <Button key={c} size="sm" onClick={() => load(c)} disabled={busy}>+{c}</Button>)}
        {busy && <Button size="sm" variant="destructive" onClick={() => { stop.current = true; }}>Stop</Button>}
        <Button size="sm" variant="outline" onClick={clearDummy} disabled={busy}>🗑 Dummy products hatao</Button>
      </div>
      {target > 0 && (
        <div className="mt-3">
          <Progress value={(done / target) * 100} />
          <p className="mt-1 text-xs text-muted-foreground">{done} / {target} added</p>
        </div>
      )}
    </section>
  );
}
