import { describe, expect, it } from "vitest";
import { THEMES, themeCss } from "./themes";
import { computeOrder, orderStats } from "./orders";

describe("themes", () => {
  it("offers at least 10 business themes", () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(10);
  });
  it("theme css sets primary colour", () => {
    expect(themeCss("grocery")).toContain("--primary:oklch(0.52 0.16 145)");
  });
});

describe("orders", () => {
  it("uses store prices, not browser prices", () => {
    const r = computeOrder([{ id: "a", qty: 2, color: "", size: "" }, { id: "zz", qty: 1, color: "", size: "" }], { a: { name: "Bra", price: 500 } });
    expect(r.total).toBe(1000);
    expect(r.items).toHaveLength(1);
  });
  it("revenue excludes cancelled; pending deliveries count pending+dispatched", () => {
    const s = orderStats([{ total: 100, status: "pending" }, { total: 200, status: "dispatched" }, { total: 300, status: "cancelled" }, { total: 50, status: "delivered" }]);
    expect(s).toEqual({ totalOrders: 4, revenue: 350, pending: 2 });
  });
});
