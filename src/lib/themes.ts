export type Theme = { id: string; label: string; hue: number; chroma: number; light: number; font: string };

export const THEMES: Theme[] = [
  { id: "fashion", label: "Fashion & Boutique", hue: 352, chroma: 0.21, light: 0.52, font: "'Playfair Display', serif" },
  { id: "bakery", label: "Food & Bakery", hue: 55, chroma: 0.15, light: 0.55, font: "'Fredoka', sans-serif" },
  { id: "electronics", label: "Electronics & Gadgets", hue: 250, chroma: 0.19, light: 0.5, font: "'Space Grotesk', sans-serif" },
  { id: "grocery", label: "Grocery & Daily Essentials", hue: 145, chroma: 0.16, light: 0.52, font: "'DM Sans', sans-serif" },
  { id: "pharmacy", label: "Health & Pharmacy", hue: 190, chroma: 0.12, light: 0.5, font: "'DM Sans', sans-serif" },
  { id: "beauty", label: "Beauty & Cosmetics", hue: 15, chroma: 0.15, light: 0.6, font: "'Playfair Display', serif" },
  { id: "decor", label: "Home Decor & Furniture", hue: 70, chroma: 0.09, light: 0.45, font: "'Playfair Display', serif" },
  { id: "kids", label: "Kids & Toys", hue: 300, chroma: 0.2, light: 0.58, font: "'Fredoka', sans-serif" },
  { id: "books", label: "Books & Stationery", hue: 30, chroma: 0.12, light: 0.4, font: "'Playfair Display', serif" },
  { id: "minimal", label: "Modern Minimal", hue: 260, chroma: 0.01, light: 0.22, font: "'Space Grotesk', sans-serif" },
  { id: "jewellery", label: "Jewellery & Gifts", hue: 85, chroma: 0.13, light: 0.62, font: "'Playfair Display', serif" },
];

export const getTheme = (id: string) => THEMES.find((t) => t.id === id) ?? THEMES[0]!;

export const LAYOUTS = [
  { id: "boutique", label: "Boutique", desc: "Banner, search, category tabs, product grid" },
  { id: "deals", label: "Flash Sale", desc: "Deal of the day, countdown, sale grid" },
  { id: "minimal", label: "Brand Showcase", desc: "Bada hero, trust badges, curated collection" },
] as const;

/** CSS variables for a theme; overrides the default tokens site-wide. */
export function themeCss(id: string): string {
  const t = getTheme(id);
  const h = t.hue;
  const c = t.chroma;
  const fg = t.light > 0.6 ? "oklch(0.2 0.02 " + h + ")" : "oklch(0.99 0.005 " + h + ")";
  const vars: Record<string, string> = {
    "--primary": `oklch(${t.light} ${c} ${h})`,
    "--primary-foreground": fg,
    "--ring": `oklch(${t.light} ${c} ${h})`,
    "--background": `oklch(0.99 ${Math.min(c, 0.006)} ${h})`,
    "--foreground": `oklch(0.2 0.02 ${h})`,
    "--secondary": `oklch(0.95 ${c * 0.12} ${h})`,
    "--secondary-foreground": `oklch(0.3 ${c * 0.3} ${h})`,
    "--muted": `oklch(0.965 ${c * 0.05} ${h})`,
    "--accent": `oklch(0.93 ${c * 0.2} ${h})`,
    "--accent-foreground": `oklch(0.35 ${c * 0.6} ${h})`,
    "--border": `oklch(0.91 ${c * 0.07} ${h})`,
    "--input": `oklch(0.91 ${c * 0.07} ${h})`,
    "--gradient-hero": `linear-gradient(120deg, oklch(0.95 ${c * 0.17} ${h}), oklch(0.99 0.006 ${h}) 50%, oklch(0.93 ${c * 0.25} ${h + 20}))`,
    "--font-display": t.font,
  };
  return `:root{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(";")}}`;
}
