import { cleanBrands } from "./brandwipe";
import { colorNameToHex, guessCategory, parsePrice } from "./extract";
import { STORE_BRAND, sanitizeImages, type ImportedProduct } from "./types";

type Row = Record<string, unknown>;

/** RFC-4180 style CSV parser (quotes, escaped quotes, newlines inside quotes). */
export function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let q = false;
  const s = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { cur.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      cur.push(field); field = "";
      if (cur.some((c) => c.trim() !== "")) rows.push(cur);
      cur = [];
    } else field += ch;
  }
  cur.push(field);
  if (cur.some((c) => c.trim() !== "")) rows.push(cur);
  const [head, ...body] = rows;
  if (!head) return [];
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ""])));
}

/** Accepts a JSON array, an object wrapping an array (items/products/data), or JSON lines. */
export function parseJson(text: string): Row[] {
  const t = text.replace(/^\uFEFF/, "").trim();
  try {
    const v = JSON.parse(t);
    if (Array.isArray(v)) return v.filter((x) => x && typeof x === "object");
    if (v && typeof v === "object") {
      for (const k of ["items", "products", "data", "results"]) if (Array.isArray(v[k])) return v[k];
      return [v];
    }
    return [];
  } catch {
    return t.split(/\r?\n/).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  }
}

export function parseFile(name: string, text: string): Row[] {
  const t = text.trim();
  if (/\.json[l]?$/i.test(name) || t.startsWith("[") || t.startsWith("{")) return parseJson(text);
  return parseCsv(text);
}

const norm = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Read the first non-empty value among header aliases (case/space/underscore insensitive, dotted paths OK). */
function pick(row: Row, aliases: string[]): unknown {
  const keys = Object.keys(row);
  for (const a of aliases) {
    const k = keys.find((x) => norm(x) === norm(a));
    const v = k ? row[k] : undefined;
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

/** Split a value into a list: arrays, JSON-array strings, comma / semicolon / pipe / newline separated. */
export function toList(v: unknown): string[] {
  if (v == null || v === "") return [];
  if (Array.isArray(v)) {
    return v.flatMap((x) => (x && typeof x === "object" ? [String((x as Row)["url"] ?? (x as Row)["src"] ?? (x as Row)["name"] ?? (x as Row)["value"] ?? "")] : toList(x)));
  }
  if (typeof v === "object") return toList((v as Row)["url"] ?? (v as Row)["src"] ?? (v as Row)["name"]);
  const s = String(v).trim();
  if (s.startsWith("[")) { try { return toList(JSON.parse(s)); } catch { /* fall through */ } }
  return s.split(/\s*[;,|\n]\s*/).map((x) => x.trim()).filter(Boolean);
}

/** Image links are split on separators but URLs may contain commas, so split on separator before http. */
export function toImageList(v: unknown): string[] {
  if (typeof v === "string" && !v.trim().startsWith("[")) {
    return v.split(/[\s;,|]+(?=(?:https?:)?\/\/)/i).map((x) => x.trim().replace(/[;,|]+$/, "")).filter((x) => /^(https?:)?\/\//i.test(x));
  }
  return toList(v).filter((x) => /^(https?:)?\/\//i.test(x));
}

/** Stable duplicate key: normalised product link, else "sku:<id>". */
export function dedupeKey(sourceUrl: string): string {
  const s = sourceUrl.trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) return s.toLowerCase();
  try {
    const u = new URL(s);
    return (u.host.replace(/^www\./, "") + u.pathname.replace(/\/+$/, "")).toLowerCase();
  } catch {
    return s.toLowerCase();
  }
}

export type MappedRow = { product: ImportedProduct; key: string; problem?: string | undefined };

export function mapRow(row: Row, categoryIds: string[]): MappedRow {
  const name = String(pick(row, ["title", "name", "product_name", "productName", "productTitle"]) ?? "").trim();
  const url = String(pick(row, ["url", "productUrl", "product_url", "link", "productLink"]) ?? "").trim();
  const id = String(pick(row, ["product_id", "productId", "sku", "id", "styleCode"]) ?? "").trim();
  const source_url = url || (id ? `sku:${id}` : "");
  const sale = parsePrice(pick(row, ["currentPrice", "offer_price", "offerPrice", "salePrice", "sellingPrice", "price", "price.current", "finalPrice"]));
  const mrp = parsePrice(pick(row, ["originalPrice", "mrp", "listPrice", "old_price", "compareAtPrice", "price.original"]));
  const price = sale || mrp;
  const images = sanitizeImages(
    toImageList(pick(row, ["images", "imageUrls", "image_urls", "gallery", "photos", "image", "imageUrl", "image_url", "thumbnail", "mainImage"])).map((u) => (u.startsWith("//") ? `https:${u}` : u)),
  );
  const description = String(pick(row, ["description", "productDescription", "details", "desc"]) ?? "").trim();
  const rawCat = String(pick(row, ["category", "categoryName", "productType", "type"]) ?? "").trim();
  const catSlug = rawCat.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const category = categoryIds.includes(catSlug) ? catSlug : guessCategory(`${rawCat} ${name}`);
  const sizes = [...new Set(toList(pick(row, ["sizes", "size", "availableSizes", "variants.size"])))];
  const colors = [...new Set(toList(pick(row, ["colors", "colours", "color", "colour"])))].map((c) => ({ name: c, hex: colorNameToHex(c), images: [] as string[] }));
  const product = cleanBrands<ImportedProduct>(
    {
      name, brand: STORE_BRAND, category, price, old_price: mrp > price ? mrp : price, description,
      highlights: [], specs: {}, sizes, colors, images, source_url,
    },
    STORE_BRAND,
  );
  const problem = !name ? "No title" : !price ? "No price" : !source_url ? "No url / id" : !images.length ? "No photos" : undefined;
  return { product, key: dedupeKey(source_url), problem };
}

export type ImportPlan = { total: number; fresh: MappedRow[]; duplicates: MappedRow[]; invalid: MappedRow[] };

/** Split rows into new / duplicate (already in store or repeated in file) / invalid. */
export function planImport(rows: Row[], existingKeys: Set<string>, categoryIds: string[]): ImportPlan {
  const seen = new Set(existingKeys);
  const plan: ImportPlan = { total: rows.length, fresh: [], duplicates: [], invalid: [] };
  for (const r of rows) {
    const m = mapRow(r, categoryIds);
    if (m.problem) plan.invalid.push(m);
    else if (seen.has(m.key)) plan.duplicates.push(m);
    else { seen.add(m.key); plan.fresh.push(m); }
  }
  return plan;
}
