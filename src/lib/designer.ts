/** Pure rules for the AI Designer Studio (no network, safe to test). */

export const BRA_SIZES = ["30B", "30C", "32B", "32C", "32D", "34B", "34C", "34D", "34DD", "36B", "36C", "36D", "36DD", "38B", "38C", "38D", "40B", "40C", "40D", "42C", "42D"];
export const FREE_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"];

export const DESIGN_COLORS: { name: string; hex: string }[] = [
  { name: "Jet Black", hex: "#111111" }, { name: "Pure Ivory", hex: "#F6F1E7" }, { name: "Natural Nude", hex: "#D9B49A" },
  { name: "Wine Burgundy", hex: "#6D1A2B" }, { name: "Dusty Rose", hex: "#C99A9A" }, { name: "Emerald Green", hex: "#1F6B4F" },
  { name: "Royal Navy", hex: "#1E2A4A" }, { name: "Champagne Gold", hex: "#D8C08E" }, { name: "Plum Mauve", hex: "#7A4E6E" },
];

export const DESIGN_STYLES = [
  "Everyday Indian Cotton", "Classic Market Bestsellers", "T-Shirt & Seamless", "Luxury & Bridal Lace",
  "Romantic Floral", "Bold Party Wear", "Sporty & Active", "Mix of all styles",
];

export const DESIGN_CATEGORIES = [
  { id: "bra", label: "Bras" }, { id: "panty", label: "Panties" }, { id: "nightwear", label: "Nightwear" },
  { id: "set", label: "Lingerie Sets" }, { id: "shapewear", label: "Shapewear" }, { id: "activewear", label: "Activewear" },
  { id: "teen", label: "Teen & Beginners" },
];

export const TEEN_SIZES = ["28A", "28B", "30A", "30B", "32A", "32B", "34A", "34B", "XS", "S", "M", "L"];

/** Every size is always offered: bras and sets get the full band/cup range, teen a beginner range, the rest XS–4XL. */
export function sizesFor(category: string): string[] {
  if (category === "teen") return [...TEEN_SIZES];
  return category === "bra" || category === "set" ? [...BRA_SIZES] : [...FREE_SIZES];
}

const byName = new Map(DESIGN_COLORS.map((c) => [c.name.toLowerCase(), c]));

/** 4–6 colours per design: the AI's picks first (known names only), topped up from the palette. */
export function colorsFor(picked: string[], seed: number): { name: string; hex: string }[] {
  const out: { name: string; hex: string }[] = [];
  for (const p of picked) { const c = byName.get(p.trim().toLowerCase()); if (c && !out.includes(c) && out.length < 6) out.push(c); }
  for (let i = 0; out.length < 4; i++) { const c = DESIGN_COLORS[(seed + i) % DESIGN_COLORS.length]!; if (!out.includes(c)) out.push(c); }
  return out;
}

/** Selling price from MRP and discount, never below 1. */
export function sellPrice(mrp: number, discount: number): number {
  return Math.max(1, Math.round(mrp * (100 - Math.min(80, Math.max(0, discount))) / 100));
}
