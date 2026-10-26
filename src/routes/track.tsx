import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { trackOrders } from "@/lib/store.functions";
import { rupees } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/track")({
  head: () => ({
    meta: [
      { title: "Order track karein – Glamour Boutique" },
      { name: "description", content: "Mobile number aur order code se apne Glamour Boutique order ka status dekhein." },
      { property: "og:title", content: "Order track karein – Glamour Boutique" },
      { property: "og:description", content: "Apne order ka live status aur courier tracking dekhein." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrackPage,
});

const LABEL: Record<string, string> = { pending: "Order mil gaya", dispatched: "Courier se bhej diya", delivered: "Deliver ho gaya", cancelled: "Cancel ho gaya" };
type Row = Awaited<ReturnType<typeof trackOrders>>[number];

function TrackPage() {
  const track = useServerFn(trackOrders);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);

  const go = async () => {
    if (!/^[6-9]\d{9}$/.test(phone.trim()) || code.trim().length < 6) { toast.error("10 digit mobile number aur 8 akshar ka order code likhiye"); return; }
    setBusy(true);
    try { setRows(await track({ data: { phone: phone.trim(), code: code.trim() } })); }
    catch { toast.error("Abhi check nahi ho paya, dobara try karein"); }
    setBusy(false);
  };

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="font-display text-3xl">Order track karein</h1>
      <p className="mt-1 text-sm text-muted-foreground">Order ke baad mila 8 akshar ka code aur apna mobile number daaliye.</p>
      <div className="mt-6 space-y-3">
        <Input placeholder="Mobile number" inputMode="numeric" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input placeholder="Order code (jaise a1b2c3d4)" value={code} onChange={(e) => setCode(e.target.value)} />
        <Button className="w-full" onClick={go} disabled={busy}>{busy ? "Check ho raha hai…" : "Status dekhein"}</Button>
      </div>
      {rows && rows.length === 0 && <p className="mt-6 text-center text-sm text-muted-foreground">Koi order nahi mila. Number aur code dobara check karein.</p>}
      {rows?.map((o) => (
        <div key={o.id} className="mt-6 rounded-xl border bg-card p-4 text-sm">
          <div className="flex justify-between"><b>#{o.id.slice(0, 8)}</b><span className="font-semibold text-primary">{LABEL[o.status] ?? o.status}</span></div>
          <p className="mt-1 text-muted-foreground">{new Date(o.created_at).toLocaleDateString("en-IN")} · {rupees(o.total)}</p>
          <p className="mt-2">{o.items.map((i) => `${i.name} × ${i.qty}`).join(", ")}</p>
          {o.tracking_no && <p className="mt-2">Courier tracking no.: <b>{o.tracking_no}</b></p>}
        </div>
      ))}
    </main>
  );
}
