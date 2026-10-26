import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Star, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { reviewPhotoUrl, reviewSchema, timeAgo, type Review } from "@/lib/reviews";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type P = { id: string; name: string };

export function ReviewsPanel({ products }: { products: P[] }) {
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const q = useQuery({
    queryKey: ["admin-reviews", filter],
    queryFn: async (): Promise<Review[]> => {
      let s = supabase.from("reviews").select("*").order("created_at", { ascending: false }).limit(200);
      if (filter !== "all") s = s.eq("status", filter);
      const { data, error } = await s;
      if (error) throw error;
      return data as Review[];
    },
  });
  const [busy, setBusy] = useState<string | null>(null);
  const name = (id: string) => products.find((p) => p.id === id)?.name ?? "—";
  const update = async (id: string, patch: Partial<Review>) => {
    if (busy) return;
    setBusy(id);
    const { error } = await supabase.from("reviews").update(patch).eq("id", id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Ho gaya");
    q.refetch();
  };
  const remove = async (id: string) => {
    if (!confirm("Review delete karein?")) return;
    const { error } = await supabase.from("reviews").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    q.refetch();
  };

  const approveAll = async () => {
    if (busy) return;
    setBusy("all");
    const { error } = await supabase.from("reviews").update({ status: "approved" }).eq("status", "pending");
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Saare pending reviews live ho gaye");
    q.refetch();
  };

  return (
    <div className="space-y-6">
      <AutoApproveBox onApproveAll={approveAll} busy={busy === "all"} />
      <SampleForm products={products} onDone={() => q.refetch()} />
      <div className="flex flex-wrap gap-2">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} className="capitalize" onClick={() => setFilter(f)}>{f}</Button>
        ))}
      </div>
      {q.data?.length === 0 && <p className="text-sm text-muted-foreground">Koi review nahi.</p>}
      <ul className="space-y-3">
        {q.data?.map((r) => (
          <li key={r.id} className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1 font-semibold"><Star className="h-4 w-4 fill-primary text-primary" />{r.rating}</span>
              <b>{r.customer_name}</b>{r.city && <span className="text-muted-foreground">· {r.city}</span>}
              <span className="text-muted-foreground">on {name(r.product_id)}</span>
              {r.is_sample && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">Sample</span>}
              <span className="ml-auto text-xs text-muted-foreground">{timeAgo(r.created_at)} · {r.status}</span>
            </div>
            <p className="mt-2 text-sm">{r.body}</p>
            {r.photos.length > 0 && <div className="mt-2 flex gap-2">{r.photos.map((p) => <img key={p} src={reviewPhotoUrl(p)} alt="" className="h-16 w-16 rounded-md object-cover" />)}</div>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {r.status !== "approved" && <Button size="sm" disabled={busy === r.id} onClick={() => update(r.id, { status: "approved" })}>{busy === r.id ? "…" : "Approve"}</Button>}
              {r.status !== "rejected" && <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => update(r.id, { status: "rejected" })}>Reject</Button>}
              {!r.is_sample && (
                <label className="ml-2 flex items-center gap-2 text-xs">
                  <Switch checked={r.verified} onCheckedChange={(v) => update(r.id, { verified: v })} /> Verified buyer (order confirm kiya)
                </label>
              )}
              <Button size="icon" variant="ghost" className="ml-auto" aria-label="Delete" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AutoApproveBox({ onApproveAll, busy }: { onApproveAll: () => void; busy: boolean }) {
  const [auto, setAuto] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.from("store_settings").select("review_approval").eq("id", 1).maybeSingle().then(({ data }) => {
      setAuto(data ? !data.review_approval : true);
    });
  }, []);
  const toggle = async (v: boolean) => {
    const prev = auto;
    setAuto(v);
    const { error } = await supabase.from("store_settings").update({ review_approval: !v }).eq("id", 1);
    if (error) { setAuto(prev); toast.error(error.message); return; }
    toast.success(v ? "Auto-Approve ON — naye reviews turant live honge" : "Auto-Approve OFF — naye reviews Pending mein aayenge");
  };
  return (
    <section className="space-y-3 rounded-xl border-2 border-primary bg-card p-5">
      <label className="flex items-center gap-3">
        <div className="flex-1">
          <p className="text-lg font-semibold">⚡ Auto-Approve: {auto === null ? "…" : auto ? "ON" : "OFF"}</p>
          <p className="text-xs text-muted-foreground">
            ON: customer ka review submit hote hi poori website par turant live. OFF: review pehle Pending mein, aap Approve karengi tab dikhega.
          </p>
        </div>
        <Switch checked={!!auto} disabled={auto === null} onCheckedChange={toggle} />
      </label>
      <Button size="sm" variant="outline" disabled={busy} onClick={onApproveAll}>{busy ? "Approve ho rahe hain…" : "Saare Pending reviews Approve karein"}</Button>
    </section>
  );
}

function SampleForm({ products, onDone }: { products: P[]; onDone: () => void }) {
  const [pid, setPid] = useState("");
  const [n, setN] = useState("");
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const add = async () => {
    const parsed = reviewSchema.safeParse({ customer_name: n || "Store team", city: "", rating, body });
    if (!pid || !parsed.success) { toast.error("Product aur review text bharein"); return; }
    const { error } = await supabase.from("reviews").insert({ ...parsed.data, product_id: pid, is_sample: true, verified: false, status: "approved" });
    if (error) { toast.error(error.message); return; }
    toast.success("Sample review add hua");
    setBody(""); onDone();
  };
  return (
    <section className="space-y-3 rounded-xl border bg-card p-5">
      <h3 className="text-lg font-semibold">Sample review add karein</h3>
      <p className="text-xs text-muted-foreground">Customers ko "Sample review" label dikhega. Yeh rating average mein nahi gine jaate aur kabhi "Verified" nahi ho sakte.</p>
      <select value={pid} onChange={(e) => setPid(e.target.value)} className="w-full rounded-md border bg-card px-3 py-2 text-sm">
        <option value="">Product chunein…</option>
        {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <div className="flex gap-2">
        <Input placeholder="Label (e.g. Store team)" value={n} onChange={(e) => setN(e.target.value)} />
        <select value={rating} onChange={(e) => setRating(Number(e.target.value))} className="rounded-md border bg-card px-2 text-sm">
          {[5, 4, 3, 2, 1].map((i) => <option key={i} value={i}>{i}★</option>)}
        </select>
      </div>
      <Textarea placeholder="Review text" value={body} onChange={(e) => setBody(e.target.value)} />
      <Button onClick={add}>Add sample</Button>
    </section>
  );
}
