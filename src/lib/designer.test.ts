import { describe, expect, it } from "vitest";
import { colorsFor, sellPrice, sizesFor } from "./designer";

describe("AI designer rules", () => {
  it("bras offer every band and cup size", () => {
    const s = sizesFor("bra");
    expect(s).toContain("30B");
    expect(s).toContain("42D");
    expect(s.length).toBe(21);
  });
  it("panties offer XS to 4XL", () => {
    expect(sizesFor("panty")).toEqual(["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"]);
  });
  it("every design gets at least 4 colours", () => {
    expect(colorsFor([], 0).length).toBe(4);
    expect(colorsFor(["Jet Black"], 3).length).toBe(4);
  });
  it("never more than 6 colours", () => {
    expect(colorsFor(["Jet Black", "Pure Ivory", "Natural Nude", "Wine Burgundy", "Dusty Rose", "Emerald Green", "Royal Navy"], 0).length).toBe(6);
  });
  it("price follows MRP and discount", () => {
    expect(sellPrice(1000, 40)).toBe(600);
  });
  it("teen range gets beginner sizes", () => {
    expect(sizesFor("teen")).toContain("28A");
  });
});
