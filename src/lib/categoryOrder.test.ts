import { describe, expect, it } from "vitest";
import { moveItem } from "@/components/CategoryOrderPanel";

describe("category reorder", () => {
  it("moves the last category to first", () => {
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });
  it("moves the first category to last", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });
});
