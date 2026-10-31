import { describe, expect, it } from "vitest";
import { shopifyJsonUrl, shopifyLinks } from "./autoqueue";

describe("Shopify fast copy", () => {
  it("uses the collection's products.json with 250 per page", () =>
    expect(shopifyJsonUrl("https://shop.in/collections/bras?sort=x", 3)).toBe("https://shop.in/collections/bras/products.json?limit=250&page=3"));
  it("falls back to the whole store when no collection", () =>
    expect(shopifyJsonUrl("https://shop.in/", 1)).toBe("https://shop.in/products.json?limit=250&page=1"));
  it("turns handles into product links", () =>
    expect(shopifyLinks('{"products":[{"handle":"red-bra"}]}', "https://shop.in/collections/bras")).toEqual(["https://shop.in/products/red-bra"]));
  it("returns null for non-Shopify pages", () => expect(shopifyLinks("<html>", "https://x.in")).toBeNull());
});
