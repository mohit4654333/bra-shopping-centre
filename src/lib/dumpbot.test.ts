import { describe, expect, it } from "vitest";
import { dumpPlan, discountPercent } from "./dumpbot";

describe("dump bot", () => {
  it("splits 1000 products across 8 categories exactly", () => {
    const plan = dumpPlan(1000);
    expect(plan.reduce((s, p) => s + p.count, 0)).toBe(1000);
    expect(new Set(plan.map((p) => p.slug)).size).toBe(8);
    expect(Math.max(...plan.map((p) => p.count))).toBeLessThanOrEqual(100);
  });
  it("shows 50% OFF for MRP 1998 at 999", () => {
    expect(discountPercent(1998, 999)).toBe(50);
  });
});
