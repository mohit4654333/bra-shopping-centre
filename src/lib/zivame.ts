import type { ColorVariant, ImportedProduct } from "./types";
import { colorNameToHex } from "./extract";

const CDN = "https://cdn.zivame.com";

function balanced(s: string, start: number): string | null {
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

const fixName = (c: string) => {
  const n = c.toUpperCase() === "SLIVER" ? "SILVER" : c;
  return n.toLowerCase().replace(/\b\w/g, (x) => x.toUpperCase());
};

/** Encode a folder name exactly once (spaces -> %20), keeping its original case. */
export function encodeFolder(code: string): string {
  let raw = code;
  try { raw = decodeURIComponent(code); } catch { /* already raw */ }
  return encodeURIComponent(raw);
}

/**
 * Photo candidates for a non-selected colour. Uses the same count as the real gallery
 * (never a blind guess) and keeps the swatch's own extension case (.JPG vs .jpg).
 * The importer later checks each URL and drops ones that don't exist.
 */
export function zivameColorImages(productImage: string, count: number): string[] {
  const m = productImage.match(/configimages\/([^/?]+)\/(?:\d+_[a-z]+)?(\.(?:jpe?g|png|webp))?/i);
  const code = m?.[1];
  if (!code || count < 1) return [];
  const ext = m?.[2] ?? ".jpg";
  return Array.from({ length: count }, (_, i) => `${CDN}/media/zcmsimages/configimages/${encodeFolder(code)}/${i + 1}_large${ext}`);
}

/** Reads Zivame's embedded productData (Next.js stream) — no AI needed. */
export function fromZivameRsc(html: string): Partial<ImportedProduct> {
  const idx = html.indexOf("productData");
  if (idx === -1) return {};
  const sStart = html.lastIndexOf("<script", idx);
  const sEnd = html.indexOf("</script>", idx);
  const raw = html.slice(sStart === -1 ? 0 : sStart, sEnd === -1 ? html.length : sEnd);
  const candidates = [raw, raw.replace(/\\"/g, '"').replace(/\\\\/g, "\\")];
  for (const text of candidates) {
    const p = text.indexOf('"productData":{');
    if (p === -1) continue;
    const json = balanced(text, p + 14);
    if (!json) continue;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const obj: any = JSON.parse(json);
      const sm = obj.summary ?? {};
      const media: string[] = (obj.media?.values ?? [])
        .map((m: { large?: string; medium?: string }) => m.large || m.medium || "")
        .filter(Boolean)
        .map((u: string) => (u.startsWith("http") ? u : CDN + u).split("?")[0]);
      // Every size group (e.g. each band) — combine so all cup/band sizes like 32B, 34C come through.
      const sizes: string[] = [...new Set<string>(
        (obj.sizes?.products ?? []).flatMap((g: { sizes?: { size?: string }[] }) => (g.sizes ?? []).map((s) => String(s.size ?? "").trim())),
      )].filter(Boolean);
      const colors: ColorVariant[] = (obj.availableColors?.values ?? []).map(
        (c: { color?: string; productImage?: string; highlight?: boolean }) => {
          const name = fixName(c.color ?? "");
          const images = c.highlight && media.length ? media : zivameColorImages(c.productImage ?? "", media.length);
          return { name, hex: colorNameToHex(name), images };
        },
      ).filter((c: ColorVariant) => c.name && c.images.length);
      const desc = typeof obj.description === "string" ? obj.description : "";
      const price = Number(sm.specialPrice || sm.price || 0);
      const out: Record<string, unknown> = {
        name: String(sm.name ?? "").replace(/\s*-\s*[A-Za-z ]+$/, "") || undefined,
        price: price || undefined,
        old_price: sm.specialPrice && sm.price > sm.specialPrice ? Number(sm.price) : undefined,
        sizes: sizes.length ? sizes : undefined,
        colors: colors.length ? colors : undefined,
        images: media.length ? media : undefined,
        description: desc ? desc.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : undefined,
      };
      return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined)) as Partial<ImportedProduct>;
    } catch {
      /* try next */
    }
  }
  return {};
}
