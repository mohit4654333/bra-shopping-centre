import { describe, expect, it } from "vitest";
import { looksBlocked } from "./import.server";

const pad = "x".repeat(20000);

describe("blocked page detection (any website)", () => {
  it("treats a 'Site Maintenance' page as blocked", () => {
    expect(looksBlocked(`<html><head><title>Site Maintenance</title></head><body>${pad} "price": 1</body></html>`)).toBe(true);
  });
  it("treats a big page with no product signs as blocked", () => {
    expect(looksBlocked(`<html><title>Hello</title><body>${pad}</body></html>`)).toBe(true);
  });
  it("accepts a real product page", () => {
    expect(looksBlocked(`<html><title>Lace Bra</title><body>${pad}<script type="application/ld+json">{"@type":"Product"}</script></body></html>`)).toBe(false);
  });
});
