import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Percent } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { rupees } from "@/lib/cart";
import { bulkDiscountPrice, mrpOf } from "@/lib/merch";
import type { Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Store-wide discount: one database update sets every product's price from its MRP. */
export function BulkPricingPanel({ products }: { products: Product[] }) {
  const qc = useQueryClient();
  const [pct, setPct] = useState("70");
  const [busy, setBusy] = useState(false);
  const n = Number(pct);
  const valid = pct.trim() !== "" && Number.isInteger(n) && n >= 0 && n <= 95;
  const sample = products.find((p) => mrpOf(p) > 0);

  const apply = async () => {
    if (!valid) { toast.error("Enter a whole number from 0 to 95"); return; }
    if (!confirm(`Set ${n}% off on all ${products.length} products? Prices will be recalculated from MRP.`)) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("apply_bulk_discount", { _percent: n });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(n === 0 ? `Discount removed from ${data} products` : `${n}% off applied to ${data} products`);
    qc.invalidateQueries();
  };

  return (
    <section className="mt-4 rounded-xl border bg-card p-5">
      <h2 className="flex items-center gap-2 text-xl font-semibold"><Percent className="h-5 w-5 text-primary" />Bulk Pricing</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Give every product in the store the same discount in one click. Selling price is recalculated from each product's MRP.
        Products without an MRP use their current price as MRP. Enter 0 to remove all discounts.
      </p>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">
          Discount percentage
          <div className="relative mt-1 w-40">
            <Input type="number" inputMode="numeric" min={0} max={95} value={pct} onChange={(e) => setPct(e.target.value)} onKeyDown={(e) => e.key === "Enter" && apply()} className="pr-8 text-lg font-semibold" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
          </div>
        </label>
        <div className="flex gap-2">
          {[30, 50, 70].map((v) => (
            <Button key={v} type="button" size="sm" variant={String(v) === pct ? "default" : "outline"} onClick={() => setPct(String(v))}>{v}%</Button>
          ))}
        </div>
        <Button onClick={apply} disabled={busy || !valid || products.length === 0} className="sm:ml-auto sm:w-48">
          {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Applying…</> : "Apply Discount"}
        </Button>
      </div>

      <div className="mt-5 rounded-lg bg-secondary p-4 text-sm">
        <p><b>{products.length}</b> products will be updated.</p>
        {sample && valid && (
          <p className="mt-1 text-muted-foreground">
            Example: “{sample.name.slice(0, 50)}” — MRP {rupees(mrpOf(sample))} → <b className="text-foreground">{rupees(bulkDiscountPrice(mrpOf(sample), n))}</b> ({n}% off)
          </p>
        )}
      </div>
    </section>
  );
}
