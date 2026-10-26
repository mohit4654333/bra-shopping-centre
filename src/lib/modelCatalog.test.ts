import { describe, expect, it } from "vitest";
import { BATCHES, MODEL_CATS, chunks } from "./modelCatalog";

describe("model catalog loader", () => {
  it("offers +50, +100, +250, +500, +1000", () => {
    expect([...BATCHES]).toEqual([50, 100, 250, 500, 1000]);
  });
  it("splits 1000 into four server batches of 250", () => {
    expect(chunks(1000)).toEqual([250, 250, 250, 250]);
  });
  it("lists all 7 retail categories plus All", () => {
    expect(MODEL_CATS.map((c) => c.id)).toEqual(["all", "bra", "panty", "girls", "combo", "starter", "nightwear", "set", "shapewear", "activewear"]);
  });
});
