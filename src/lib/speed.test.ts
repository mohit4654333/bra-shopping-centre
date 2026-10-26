import { describe, expect, it } from "vitest";
import { IMPORT_CONCURRENCY, PILOT_BATCH, QUEUE_DELAY_MS, pool } from "./autoqueue";
import { looksLikeImage } from "./import.server";

describe("Auto-Pilot speed rules", () => {
  it("has no queue delay between imports", () => expect(QUEUE_DELAY_MS).toBe(0));
  it("imports 12 products at once (within 10-15)", () => {
    expect(IMPORT_CONCURRENCY).toBeGreaterThanOrEqual(10);
    expect(IMPORT_CONCURRENCY).toBeLessThanOrEqual(15);
  });
  it("one scan queues enough links for 1000+/hour", () => expect(PILOT_BATCH * 60).toBeGreaterThanOrEqual(1000));

  it("pool never runs more than the limit at once and keeps every result", async () => {
    let live = 0, peak = 0;
    const res = await pool(Array.from({ length: 40 }, (_, i) => i), 12, async (n) => {
      live++; peak = Math.max(peak, live);
      await new Promise((r) => setTimeout(r, 5));
      live--;
      if (n === 3) throw new Error("bad");
      return n;
    });
    expect(peak).toBe(12);
    expect(res).toHaveLength(40);
    expect(res.filter((r) => r.status === "rejected")).toHaveLength(1);
  });

  it("checks photos without network calls", () => {
    expect(looksLikeImage("https://cdn.zivame.com/media/catalog/product/a/b/bra-black-1.jpg")).toBe(true);
    expect(looksLikeImage("https://cdn.zivame.com/media/logo.png")).toBe(false);
    expect(looksLikeImage("data:image/png;base64,xx")).toBe(false);
  });
});
