import { describe, expect, it } from "vitest";
import { sanitizeImages, slugifyCategory } from "./types";
import { zivameColorImages } from "./zivame";

describe("image cleanup", () => {
  it("removes empty, broken and duplicate links before saving", () => {
    const r = sanitizeImages(["", "https://a.com/1.jpg", "https://a.com/1.jpg?x=2", "https://a.com/404.jpg", " "], new Set(["https://a.com/404.jpg"]));
    expect(r).toEqual(["https://a.com/1.jpg"]);
  });
});

describe("zivame colour photos", () => {
  it("encodes spaces once, keeps .JPG and never invents more photos than the gallery has", () => {
    const r = zivameColorImages("/media/zcmsimages/configimages/ZI 12 Nude/1_small.JPG", 3);
    expect(r).toHaveLength(3);
    expect(r[2]).toBe("https://cdn.zivame.com/media/zcmsimages/configimages/ZI%2012%20Nude/3_large.JPG");
    expect(zivameColorImages("/media/zcmsimages/configimages/ZI%2012/1_small.jpg", 2)[0]).toContain("ZI%2012/1_large.jpg");
  });
  it("returns no photos when the colour has no code", () => {
    expect(zivameColorImages("", 4)).toEqual([]);
  });
});

describe("categories", () => {
  it("makes ids from labels", () => {
    expect(slugifyCategory("  Bridal Sets! ")).toBe("bridal-sets");
  });
});

import { colorsMissingPhotos } from "./types";
describe("colour photos", () => {
  it("flags colours with fewer than 3 distinct photos", () => {
    expect(colorsMissingPhotos([
      { name: "Ruby Red", images: ["/a.jpg", "/b.jpg", "/c.jpg"] },
      { name: "Pure White", images: ["/a.jpg", "/a.jpg", "/b.jpg"] },
      { name: "Royal Navy", images: [] },
    ])).toEqual(["Pure White", "Royal Navy"]);
  });
});
