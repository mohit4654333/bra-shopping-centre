import type { ColorVariant, Product } from "./types";

// The row comes straight from the database where jsonb columns are loosely typed;
// normalizeProduct turns it into the strict Product shape the storefront uses.
type Row = {
  id: string; name: string; brand: string; category: string; price: number | string;
  old_price: number | string; description: string; highlights: unknown; specs: unknown;
  badge: string; sizes: unknown; colors: unknown; images: unknown;
  source_url: string | null; featured: boolean; pinned?: boolean; created_at?: string;
};

function stringList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export function normalizeProduct(r: Row): Product {
  const colors = (Array.isArray(r.colors) ? r.colors : []) as Partial<ColorVariant & { img: string }>[];
  return {
    id: r.id,
    name: r.name,
    brand: r.brand,
    category: r.category,
    price: Number(r.price),
    old_price: Number(r.old_price),
    description: r.description,
    highlights: stringList(r.highlights),
    specs: (r.specs && typeof r.specs === "object" ? r.specs : {}) as Record<string, string>,
    badge: r.badge,
    sizes: stringList(r.sizes),
    colors: colors.map((c) => ({
      name: c.name ?? "",
      hex: c.hex ?? "#c71585",
      images: Array.isArray(c.images) ? c.images : c.img ? [c.img] : [],
    })),
    images: stringList(r.images),
    source_url: r.source_url ?? "",
    featured: r.featured,
    pinned: !!r.pinned,
    ...(r.created_at ? { created_at: r.created_at } : {}),
  };
}
