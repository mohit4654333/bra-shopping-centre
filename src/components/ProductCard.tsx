import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { settingsQuery } from "@/lib/store.functions";
import { coverImage, imagesForColor, type Product } from "@/lib/types";
import { rupees, useCart } from "@/lib/cart";
import { SafeImg } from "./SafeImg";
import { LikeButton } from "./LikeShare";

export function ProductCard({ p }: { p: Product }) {
  const [ci, setCi] = useState(-1);
  const imgs = ci >= 0 ? imagesForColor(p, ci) : [coverImage(p) ?? "", ...imagesForColor(p, 0).slice(1)];
  const { data: st } = useSuspenseQuery(settingsQuery);
  const { add, setStep, setOpen } = useCart();
  const navigate = useNavigate();
  const buyNow = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const color = p.colors[Math.max(ci, 0)];
    if (st.show_sizes && p.sizes.length > 1) {
      toast("Pehle size chunein");
      navigate({ to: "/product/$id", params: { id: p.id }, search: { color: color?.name } });
      return;
    }
    add({ id: p.id, name: p.name, price: p.price, image: imgs[0] ?? "", color: st.show_colors ? color?.name ?? "" : "", size: st.show_sizes ? p.sizes[0] ?? "" : "" });
    setStep("details"); setOpen(true);
  };
  const off = p.old_price > p.price ? Math.round((1 - p.price / p.old_price) * 100) : 0;
  return (
    <Link to="/product/$id" params={{ id: p.id }} search={{ color: ci >= 0 ? p.colors[ci]?.name : undefined }}
      className="group block overflow-hidden rounded-lg bg-card [content-visibility:auto] [contain-intrinsic-size:auto_420px] hover:shadow-lg">
      <div className="relative aspect-[2/3] overflow-hidden bg-card">
        <SafeImg src={imgs[0]} alt={p.name} className="h-full w-full object-contain transition-opacity duration-300" />
        {imgs[1] && <SafeImg src={imgs[1]} alt="" className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100" />}
        {p.badge && <span className="absolute left-2 top-2 rounded bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">{p.badge}</span>}
        <LikeButton id={p.id} className="absolute right-2 top-2" />
      </div>
      <div className="space-y-1 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{p.brand}</p>
        <p className="line-clamp-2 text-sm">{p.name}</p>
        <p className="text-sm"><b>{rupees(p.price)}</b>{off > 0 && <><span className="ml-2 text-xs text-muted-foreground line-through">{rupees(p.old_price)}</span><span className="ml-2 text-xs font-semibold text-success">{off}% off</span></>}</p>
        {p.colors.length > 1 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {p.colors.slice(0, 9).map((c, i) => (
              <button key={c.name + i} type="button" title={c.name} aria-label={c.name}
                onMouseEnter={() => setCi(i)} onClick={(e) => { e.preventDefault(); setCi(i); }}
                className={`h-4 w-4 rounded-full border ${ci === i ? "ring-2 ring-primary ring-offset-1" : ""}`} style={{ background: c.hex }} />
            ))}
            {p.colors.length > 9 && <span className="text-[10px] text-muted-foreground">+{p.colors.length - 9}</span>}
          </div>
        )}
        {st.buy_now && <button type="button" onClick={buyNow} className="mt-2 w-full rounded-md bg-primary py-2 text-sm font-bold text-primary-foreground hover:opacity-90">Buy Now</button>}
      </div>
    </Link>
  );
}
