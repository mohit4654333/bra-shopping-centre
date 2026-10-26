import { describe, expect, it } from "vitest";
import { cleanBrandText, cleanBrands } from "./extract";
const B = "Glamour Boutique";
describe("cleanBrands", () => {
  it("removes Zivame from name", () => {
    expect(cleanBrands({ name: "Zivame Padded Wired Bra", description: "", highlights: [], specs: {} }, B).name).toBe("Padded Wired Bra");
  });
  it("replaces shop name in text", () => {
    expect(cleanBrandText("Soft fabric by Clovia", B)).toBe("Soft fabric by Glamour Boutique");
  });
  it("drops brand spec", () => {
    expect(cleanBrands({ name: "x", description: "", highlights: [], specs: { Brand: "Zivame", Fabric: "Cotton" } }, B).specs).toEqual({ Fabric: "Cotton" });
  });
});

describe("universal brand wiper", () => {
  it("replaces every competitor site name", () => {
    for (const shop of ["Myntra", "Nykaa", "Amazon", "Flipkart", "Ajio", "Meesho", "Enamor", "Amante", "Jockey"]) {
      expect(cleanBrandText(`Soft fabric by ${shop}`, B)).toBe("Soft fabric by Glamour Boutique");
    }
  });
  it("removes 'buy on / shop at / exclusive on' promo text", () => {
    expect(cleanBrandText("Super soft cotton bra. Buy on Zivame now!", B)).toBe("Super soft cotton bra.");
    expect(cleanBrandText("Seamless fit. Shop at Myntra.com for more.", B)).toBe("Seamless fit.");
    expect(cleanBrandText("Daily wear bra. Exclusive on shopnow.com", B)).toBe("Daily wear bra.");
  });
  it("strips ZI manufacturer codes", () => {
    expect(cleanBrandText("Padded Bra ZI1234 Black", B)).toBe("Padded Bra Black");
    expect(cleanBrandText("Comfy bra. Style Code: ZI10D3", B)).toBe("Comfy bra.");
  });
  it("cleans the brand field and drops seller spec rows", () => {
    const r = cleanBrands({ name: "Clovia T-Shirt Bra", brand: "Clovia", description: "", highlights: [], specs: { "Sold By": "Amazon", "Style Code": "ZI1234", Fabric: "Cotton" } }, B);
    expect(r.name).toBe("T-Shirt Bra");
    expect(r.brand).toBe("Glamour Boutique");
    expect(r.specs).toEqual({ Fabric: "Cotton" });
  });
  it("wipes competitor names from customer reviews", async () => {
    const { reviewSchema } = await import("./reviews");
    const r = reviewSchema.parse({ customer_name: "Priya", rating: 5, body: "Better than my Zivame bra" });
    expect(r.body).toBe("Better than my Glamour Boutique bra");
  });
});
