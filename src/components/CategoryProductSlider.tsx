import { useMemo, useRef } from "react";
import { useAutoSlide } from "@/lib/autoslide";
import { Link } from "@tanstack/react-router";
import { type Category, type Product } from "@/lib/types";
import { sliderPicks } from "@/lib/merch";
import { sanitizeImages } from "@/lib/types";
import { rupees } from "@/lib/cart";
import { SafeImg } from "./SafeImg";

/** All usable photos of a product (main gallery + every colour), de-duplicated. */
export function productPhotos(p: Pick<Product, "images" | "colors">): string[] {
  return sanitizeImages([...p.images, ...p.colors.flatMap((c) => c.images)]);
}

/** Read-only section: one auto-sliding row of top products per category. */
export function CategoryProductSlider({ categories, products }: { categories: Category[]; products: Product[] }) {
  const rows = useMemo(
    () =>
      categories
        .map((c) => ({ c, items: sliderPicks(products.filter((p) => productPhotos(p).length > 0), c.id) }))
        .filter((r) => r.items.length > 0),
    [categories, products],
  );
  if (!rows.length) return null;
  return (
    <section className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      {rows.map(({ c, items }) => <CategoryRow key={c.id} label={c.label} items={items} />)}
    </section>
  );
}

function CategoryRow({ label, items }: { label: string; items: Product[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useAutoSlide(ref, 3000);
  return (
    <div>
      <h2 className="mb-3 text-xl font-extrabold">Top {label}</h2>
      <div
        ref={ref}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none]"
      >
        {items.map((p) => (
          <Link key={p.id} to="/product/$id" params={{ id: p.id }} search={{ color: undefined }} className="w-40 shrink-0 snap-start overflow-hidden rounded-2xl border bg-card md:w-52">
            <div className="aspect-[2/3] bg-card">
              <SafeImg src={productPhotos(p)[0]} alt={p.name} className="h-full w-full object-contain" />
            </div>
            <div className="p-2">
              <p className="line-clamp-1 text-xs font-semibold">{p.name}</p>
              <p className="text-sm font-bold text-primary">{rupees(p.price)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
