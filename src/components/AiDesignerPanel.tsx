import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Sparkles, Square } from "lucide-react";
import { createDesign, designIdeas } from "@/lib/designer.functions";
import { DESIGN_CATEGORIES, DESIGN_STYLES } from "@/lib/designer";
import { pool } from "@/lib/autoqueue";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const PHOTOS_AT_ONCE = 4;

/** Separate admin tool: AI invents unique designs, makes a photo for each and adds them to the store. */
export function AiDesignerPanel() {
  const qc = useQueryClient();
  const ideas = useServerFn(designIdeas);
  const make = useServerFn(createDesign);
  const [category, setCategory] = useState("bra");
  const [style, setStyle] = useState(DESIGN_STYLES[0]!);
  const [total, setTotal] = useState(50);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [msg, setMsg] = useState("Ready");
  const [made, setMade] = useState<{ name: string; image: string }[]>([]);
  const stop = useRef(false);
  const run = async () => {
    setBusy(true); setDone(0); setMade([]); stop.current = false;
    let added = 0, failed = 0;
    try {
      while (added + failed < total && !stop.current) {
        const n = Math.min(25, total - added - failed);
        setMsg(`AI is inventing ${n} new designs…`);
        const { designs } = await ideas({ data: { category, style, count: n } });
        setMsg(`Making photos (${PHOTOS_AT_ONCE} at once)…`);
        await pool(designs, PHOTOS_AT_ONCE, async (design, i) => {
          try {
            const r = await make({ data: { category, design, seed: added + i } });
            added++; setMade((m) => [r, ...m].slice(0, 24));
          } catch (e) {
            failed++;
            const m = e instanceof Error ? e.message : "failed";
            if (/credits|busy/i.test(m)) { stop.current = true; toast.error(m); }
          } finally { setDone(added + failed); }
        }, () => !stop.current);
        qc.invalidateQueries();
      }
      setMsg(`Done — ${added} new designs added to the store${failed ? `, ${failed} skipped` : ""}.`);
      if (added) toast.success(`${added} AI designs added`);
    } catch (e) {
      const m = e instanceof Error ? e.message : "Something went wrong";
      setMsg(m); toast.error(m);
    } finally { setBusy(false); }
  };

  return (
    <section className="mb-6 rounded-xl border-2 border-primary/40 bg-card p-5">
      <h2 className="flex items-center gap-2 text-xl font-semibold"><Sparkles className="h-5 w-5 text-primary" /> AI Designer Studio</h2>
      <p className="mt-1 text-sm text-muted-foreground">AI creates brand-new, one-of-a-kind designs with their own photo. Every design gets a product photo, an all-colours photo, all sizes and 4–6 colours.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <select value={category} disabled={busy} onChange={(e) => setCategory(e.target.value)} className="rounded-md border bg-background px-2 py-2 text-sm">
          {DESIGN_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select value={style} disabled={busy} onChange={(e) => setStyle(e.target.value)} className="rounded-md border bg-background px-2 py-2 text-sm">
          {DESIGN_STYLES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={total} disabled={busy} onChange={(e) => setTotal(Number(e.target.value))} className="rounded-md border bg-background px-2 py-2 text-sm">
          {[10, 25, 50, 100, 200].map((n) => <option key={n} value={n}>{n} designs</option>)}
        </select>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Each design gets a product photo plus one photo showing all its colours.</p>
      <div className="mt-3 flex gap-2">
        <Button disabled={busy} onClick={run}>{busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}Create designs</Button>
        {busy && <Button variant="outline" onClick={() => { stop.current = true; }}><Square className="mr-1 h-4 w-4" />Stop</Button>}
      </div>
      <div className="mt-4">
        <Progress value={total ? (done / total) * 100 : 0} />
        <p className="mt-1 text-xs text-muted-foreground">{busy ? `${done} of ${total} · ` : ""}{msg}</p>
      </div>
      {made.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {made.map((m) => (
            <figure key={m.image} className="overflow-hidden rounded-md border bg-muted">
              <img src={m.image} alt={m.name} className="aspect-square w-full object-cover" />
              <figcaption className="truncate p-1 text-[10px]">{m.name}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
