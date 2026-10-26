import { describe, expect, it } from "vitest";
import { dedupeKey, mapRow, parseCsv, planImport, toImageList } from "./fileImport";

describe("file importer", () => {
  it("maps varied header names", () => {
    const m = mapRow({ product_name: "Lace Bra", offer_price: "₹499", mrp: "999", productUrl: "https://x.com/a", image: "https://c.com/1.jpg" }, ["bra"]);
    expect(m.product.name).toBe("Lace Bra");
    expect(m.product.price).toBe(499);
    expect(m.product.old_price).toBe(999);
    expect(m.problem).toBeUndefined();
  });

  it("reads comma, semicolon and JSON-array image lists", () => {
    expect(toImageList("https://a.com/1.jpg, https://a.com/2.jpg")).toHaveLength(2);
    expect(toImageList("https://a.com/1.jpg;https://a.com/2.jpg")).toHaveLength(2);
    expect(toImageList('["https://a.com/1.jpg","https://a.com/2.jpg","https://a.com/3.jpg"]')).toHaveLength(3);
  });

  it("parses quoted CSV fields", () => {
    const rows = parseCsv('title,images\n"Bra, red","https://a.com/1.jpg,https://a.com/2.jpg"\n');
    expect(rows[0]!["title"]).toBe("Bra, red");
  });

  it("skips products already in the store by url and repeats in the file", () => {
    const row = (u: string) => ({ title: "T", price: 100, url: u, images: "https://a.com/1.jpg" });
    const plan = planImport([row("https://www.x.com/p/1/"), row("https://x.com/p/2"), row("https://x.com/p/2")], new Set([dedupeKey("https://x.com/p/1")]), []);
    expect(plan.total).toBe(3);
    expect(plan.fresh).toHaveLength(1);
    expect(plan.duplicates).toHaveLength(2);
  });

  it("uses sku/id when there is no url", () => {
    expect(mapRow({ name: "A", price: 1, sku: "ABC", images: "https://a.com/1.jpg" }, []).product.source_url).toBe("sku:ABC");
  });
});
