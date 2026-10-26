import { describe, expect, it } from "vitest";
import { expandNumberedGalleries, fromJsonLd, fromShopify, mergeProducts, upgradeImageUrl } from "./extract";

describe("product import", () => {
  it("upgrades Amazon thumbnails to full size", () => {
    expect(upgradeImageUrl("https://m.media-amazon.com/images/I/71abc._AC_SX38_.jpg")).toBe("https://m.media-amazon.com/images/I/71abc.jpg");
  });

  it("keeps every colour with its own photos from JSON-LD variants", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "ProductGroup", name: "T-Shirt Bra", brand: { name: "Zivame" },
      hasVariant: [
        { "@type": "Product", color: "Black", image: ["https://x.com/black1.jpg", "https://x.com/black2.jpg"], offers: { price: "549" } },
        { "@type": "Product", color: "Blue", image: ["https://x.com/blue1.jpg"], offers: { price: "549" } },
        { "@type": "Product", color: "Pink", image: "https://x.com/pink1.jpg", offers: { price: "599" } },
      ],
    })}</script>`;
    const r = fromJsonLd(html, "https://x.com");
    expect(r.colors?.map((c) => c.name)).toEqual(["Black", "Blue", "Pink"]);
    expect(r.colors?.[1]?.images).toEqual(["https://x.com/blue1.jpg"]);
    expect(r.price).toBe(549);
  });

  it("maps Shopify variant photos to each colour", () => {
    const r = fromShopify({
      title: "Lace Bra", price: 89900, compare_at_price: 149900, options: ["Color", "Size"],
      images: ["//cdn.shopify.com/a/red-1.jpg", "//cdn.shopify.com/a/red-2.jpg", "//cdn.shopify.com/a/blue-1.jpg", "//cdn.shopify.com/a/blue-2.jpg"],
      variants: [
        { options: ["Red", "34B"], featured_image: { src: "//cdn.shopify.com/a/red-1.jpg" }, price: 89900 },
        { options: ["Blue", "34B"], featured_image: { src: "//cdn.shopify.com/a/blue-1.jpg" }, price: 89900 },
        { options: ["Blue", "36C"], featured_image: { src: "//cdn.shopify.com/a/blue-1.jpg" }, price: 89900 },
      ],
    }, "https://shop.com");
    expect(r.price).toBe(899);
    expect(r.old_price).toBe(1499);
    expect(r.sizes).toEqual(["34B", "36C"]);
    expect(r.colors?.find((c) => c.name === "Blue")?.images.length).toBe(2);
    expect(r.colors?.find((c) => c.name === "Red")?.images.length).toBe(2);
  });

  it("prefers the source with the most colour photos", () => {
    const m = mergeProducts([
      { name: "A", price: 500, colors: [{ name: "Black", hex: "#000000", images: [] }] },
      { colors: [{ name: "Black", hex: "#000000", images: ["a"] }, { name: "Blue", hex: "#0000ff", images: ["b", "c"] }] },
    ], "u");
    expect(m.colors.length).toBe(2);
    expect(m.name).toBe("A");
  });

  it("fills in photos 2..N for colours that only show their first photo", () => {
    const base = "https://cdn.zivame.com/media/zcmsimages/configimages/ZI1137-";
    const r = expandNumberedGalleries([
      { name: "Blue", hex: "#00f", images: [1, 2, 3, 4, 5].map((i) => `${base}Blue/${i}_large.JPG`) },
      { name: "Nude", hex: "#ddd", images: [upgradeImageUrl(`${base}Nude/1_small.jpg?t=1`)] },
    ]);
    expect(r[1]?.images.length).toBe(5);
    expect(r[1]?.images[4]).toBe(`${base}Nude/5_large.jpg`);
  });
});
