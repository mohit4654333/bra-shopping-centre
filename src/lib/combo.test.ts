import { describe, expect, it } from "vitest";
import { guessCategory, isComboText } from "./extract";

describe("combo / set detection", () => {
  it.each(["Pack of 3 Cotton Bras", "Bra Combo", "Multipack Panties", "5 Pcs Hipster", "Value Pack Briefs", "2 in 1 Bra", "Lace Bra Set"])("detects %s", (t) => {
    expect(isComboText(t)).toBe(true);
  });
  it("ignores single items", () => {
    expect(isComboText("Padded Push-Up Bra")).toBe(false);
    expect(isComboText("Seamless Hipster Panty")).toBe(false);
  });
  it("auto-categorises combos as set", () => {
    expect(guessCategory("Pack of 3 Hipster Panties")).toBe("set");
    expect(guessCategory("Multipack sports bra")).toBe("set");
    expect(guessCategory("Padded T-Shirt Bra")).toBe("bra");
  });
});
