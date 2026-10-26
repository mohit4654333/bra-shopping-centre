import { useEffect, useRef, useState } from "react";
import { ShoppingBag, Star, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo } from "@/lib/reviews";

type Activity = { kind: string; first_name: string; product_name: string; at: string };

/** Shows real recent orders / 5★ reviews only, one every 1–2 minutes. Nothing is shown if there is no real activity. */
export function SocialProofToast() {
  const [items, setItems] = useState<Activity[]>([]);
  const [current, setCurrent] = useState<Activity | null>(null);
  const idx = useRef(0);

  useEffect(() => {
    supabase.rpc("get_recent_activity").then(({ data }) => setItems((data ?? []) as Activity[]));
  }, []);

  useEffect(() => {
    if (!items.length) return;
    let t: ReturnType<typeof setTimeout>;
    let hide: ReturnType<typeof setTimeout>;
    const schedule = (first: boolean) => {
      const delay = first ? 20000 : 60000 + Math.random() * 60000;
      t = setTimeout(() => {
        setCurrent(items[idx.current % items.length]!);
        idx.current += 1;
        hide = setTimeout(() => setCurrent(null), 6000);
        schedule(false);
      }, delay);
    };
    schedule(true);
    return () => { clearTimeout(t); clearTimeout(hide); };
  }, [items]);

  if (!current) return null;
  const isOrder = current.kind === "order";
  return (
    <div role="status" className="fixed bottom-4 left-4 z-50 flex max-w-xs items-start gap-3 rounded-xl border bg-card p-3 text-card-foreground shadow-lg animate-in slide-in-from-bottom-4">
      <span className="rounded-full bg-primary/10 p-2 text-primary">{isOrder ? <ShoppingBag className="h-4 w-4" /> : <Star className="h-4 w-4 fill-primary" />}</span>
      <div className="text-sm">
        <p><b>{current.first_name}</b> ne {isOrder ? "order kiya" : "5★ review diya"}</p>
        {current.product_name && <p className="line-clamp-1 text-xs text-muted-foreground">{current.product_name}</p>}
        <p className="text-[11px] text-muted-foreground">{timeAgo(current.at)}</p>
      </div>
      <button type="button" aria-label="Close" onClick={() => setCurrent(null)} className="text-muted-foreground"><X className="h-4 w-4" /></button>
    </div>
  );
}
