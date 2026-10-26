import { describe, expect, it } from "vitest";
import { bulkDiscountPrice, mrpOf, offerProducts, popularOrder } from "./merch";

const mk = (name: string, price: number, old_price: number, description = "") => ({ name, price, old_price, description, highlights: [], specs: {} });

describe("offers", () => {
  it("shows only products with 40%+ off, biggest discount first", () => {
    const list = [mk("a", 900, 1000), mk("b", 500, 1000), mk("c", 300, 1000)];
    expect(offerProducts(list).map((p) => p.name)).toEqual(["c", "b"]);
  });
});

describe("bulk pricing", () => {
  it("70% off a ₹999 MRP sells at ₹300", () => {
    expect(bulkDiscountPrice(999, 70)).toBe(300);
  });
  it("uses price as MRP when no MRP is saved", () => {
    expect(mrpOf({ price: 499, old_price: 0 })).toBe(499);
  });
  it("0% sets price back to MRP", () => {
    expect(bulkDiscountPrice(1299, 0)).toBe(1299);
  });
});

describe("popular order", () => {
  it("leads with T-shirt, seamless, non-wired and cotton styles blended with designer picks", () => {
    const list = [mk("Plain brief", 1, 1), mk("Lace designer bra", 1, 1), mk("Seamless T-Shirt Bra", 1, 1), mk("Cotton non-wired bra", 1, 1)];
    expect(popularOrder(list).map((p) => p.name)).toEqual(["Seamless T-Shirt Bra", "Cotton non-wired bra", "Lace designer bra", "Plain brief"]);
  });
});

import { sliderPicks as _sp } from "./merch";
import { describe as _d, it as _it, expect as _e } from "vitest";
_d("sliderPicks", () => {
  _it("takes ranks 1,3,5 of a category for the top slider", () => {
    const ps = [1, 2, 3, 4, 5].map((n) => ({ id: `b${n}`, name: `Item ${n}`, category: "bra", price: 100, old_price: 0, description: "", highlights: [], specs: {} }));
    _e(_sp(ps, "bra").map((p) => p.id)).toEqual(["b1", "b3", "b5"]);
  });
});
