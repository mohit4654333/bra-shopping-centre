import { useEffect, useState } from "react";
import type { Product } from "@/lib/types";
import { popularOrder } from "@/lib/merch";

/** Ticks every `ms` after hydration (0 during SSR). */
export function useTick(ms = 3500) {
  const [t, setT] = useState(0);
  useEffect(() => { const id = setInterval(() => setT((x) => x + 1), ms); return () => clearInterval(id); }, [ms]);
  return t;
}

/** Category photos split by rank: "odd" = #1,#3,#5…, "even" = #2,#4,#6… (falls back to all if empty). */
export function rankPhotos(products: Product[], cat: string, side: "odd" | "even"): string[] {
  const items = popularOrder(products.filter((p) => p.category === cat && p.images?.[0]));
  const pick = items.filter((_, i) => (side === "odd" ? i % 2 === 0 : i % 2 === 1));
  return (pick.length ? pick : items).map((p) => p.images[0]!);
}
