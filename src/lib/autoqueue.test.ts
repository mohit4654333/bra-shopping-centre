import { describe, expect, it } from "vitest";
import { discountPercent, extractProductLinks, pageUrl, parseCommand, rejectKnown } from "./autoqueue";

describe("auto-queue", () => {
  it("page 1 is the saved URL, later pages add ?p=N on Zivame, ?page=N elsewhere", () => {
    expect(pageUrl("https://www.zivame.com/bras.html", 1)).toBe("https://www.zivame.com/bras.html");
    expect(pageUrl("https://www.zivame.com/bras.html", 3)).toBe("https://www.zivame.com/bras.html?p=3");
    expect(pageUrl("https://www.zivame.com/bras.html", 2)).toBe("https://www.zivame.com/bras.html?p=2");
    expect(pageUrl("https://shop.com/bras", 2)).toBe("https://shop.com/bras?page=2");
    expect(pageUrl("https://x.com/c/p-{page}", 2)).toBe("https://x.com/c/p-2");
  });
  it("skips already-imported URLs without opening them", () => {
    expect(rejectKnown(["https://a.com/p/1", "https://a.com/p/2"], ["https://a.com/p/1?utm=x"])).toEqual(["https://a.com/p/2"]);
  });
  it("finds product links on the same site only", () => {
    const html = `<a href="/zivame-padded-wired-bra-black.html">x</a><a href="https://other.com/p/9">y</a><a href="/cart">c</a>`;
    expect(extractProductLinks(html, "https://www.zivame.com/bras.html")).toEqual(["https://www.zivame.com/zivame-padded-wired-bra-black.html"]);
  });
  it("reads a typed command", () => {
    expect(parseCommand("Add next 15 products from Sets")).toEqual({ count: 15, channel: "sets" });
  });
  it("calculates discount", () => {
    expect(discountPercent(549, 999)).toBe(45);
    expect(discountPercent(999, 999)).toBe(0);
  });
});

describe("auto-queue guards", () => {
  it("ignores menu and collection pages", async () => {
    const { extractProductLinks } = await import("./autoqueue");
    const html = `<a href="/sleepwear-nightwear.html"></a><a href="/zivamefranchise.html"></a><a href="/bras/work-wear-bra.html"></a><a href="/bras/our-innovation.html"></a><a href="/zivame-padded-wired-bra-black.html"></a>`;
    expect(extractProductLinks(html, "https://www.zivame.com/bras.html")).toEqual(["https://www.zivame.com/zivame-padded-wired-bra-black.html"]);
  });
  it("rejects pages with ₹0 price or no photos", async () => {
    const { isRealProduct } = await import("./autoqueue");
    expect(isRealProduct({ name: "Bra", price: 0, photos: 5 })).toBe(false);
    expect(isRealProduct({ name: "Bra", price: 499, photos: 0 })).toBe(false);
    expect(isRealProduct({ name: "Bra", price: 499, photos: 3 })).toBe(true);
  });
});

describe("zero-waste importer filter", () => {
  it("drops promo/offer pages at link extraction", () => {
    const html = `<a href="/buy-2-for-1799.html"></a><a href="/bras-buy-3-at-999-offer.html"></a><a href="/collections/sale"></a><a href="/flat-50-off-on-all-bras.html"></a><a href="/zivame-padded-wired-bra-black.html"></a>`;
    expect(extractProductLinks(html, "https://www.zivame.com/bras.html")).toEqual(["https://www.zivame.com/zivame-padded-wired-bra-black.html"]);
  });
  it("keeps real products whose names look offer-like", async () => {
    const { isPromoUrl } = await import("./autoqueue");
    expect(isPromoUrl("https://x.com/zivame-3-in-1-padded-bra-off-white.html")).toBe(false);
    expect(isPromoUrl("https://x.com/collections/sale/products/lace-bra")).toBe(false);
    expect(isPromoUrl("https://www.myntra.com/bra/brand/brand-bra/12345678/buy")).toBe(false);
    expect(isPromoUrl("https://x.com/buy-2-for-1799")).toBe(true);
  });
  it("rejects scraped pages with no sizes", async () => {
    const { isRealProduct } = await import("./autoqueue");
    expect(isRealProduct({ name: "Bra", price: 499, photos: 3, sizes: 0 })).toBe(false);
    expect(isRealProduct({ name: "Bra", price: 499, photos: 3, sizes: 4 })).toBe(true);
  });
});

import { extractProductLinks as _epl } from "./autoqueue";
import { describe as _d, it as _it, expect as _e } from "vitest";
_d("sub-category menu links", () => {
  _it("drops /bras/... menu pages but keeps real products", () => {
    const html = `<a href="/bras/high-to-full-coverage-bra.html">x</a><a href="/zivame-padded-non-wired-t-shirt-bra-black.html">y</a>`;
    _e(_epl(html, "https://www.zivame.com/bras.html?x=1")).toEqual(["https://www.zivame.com/zivame-padded-non-wired-t-shirt-bra-black.html"]);
  });
});

import { listingVariants, ignoresPaging } from "./autoqueue";
import { describe as d2, it as i2, expect as e2 } from "vitest";
d2("zivame variants", () => {
  i2("walks 5 sort orders per page, sub-categories after the main page", () => {
    const v = listingVariants("https://www.zivame.com/panties.html", ["https://www.zivame.com/panties/pack-of-3.html"]);
    e2(v.length).toBe(10);
    e2(v[0]).toBe("https://www.zivame.com/panties.html");
    e2(v[5]).toBe("https://www.zivame.com/panties/pack-of-3.html");
    e2(ignoresPaging("https://www.zivame.com/bras.html")).toBe(true);
  });
});
