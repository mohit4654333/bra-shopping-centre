import { describe, it, expect } from "vitest";
import { fromImageFolders } from "./extract";

const html = `
<a href="/satin-nightdress-samba.html"><img src="https://cdn.zivame.com/p/ZI1/1_small.jpg"></a>
<img src="https://cdn.zivame.com/p/ZI1/2_large.jpg"><img src="https://cdn.zivame.com/p/ZI1/4_large.jpg">
<a href="/satin-nightdress-black.html"><img src="https://cdn.zivame.com/p/ZI2/1_small.jpg"></a>
<a href="/satin-nightdress-barbad.html"><img src="https://cdn.zivame.com/p/ZI3/1_small.jpg"></a>`;

describe("fromImageFolders", () => {
  it("makes one colour per photo folder, using only photos that appear on the page", () => {
    const c = fromImageFolders(html, "https://www.zivame.com");
    expect(c.map((x) => x.name)).toEqual(["Samba", "Black", "Barbad"]);
    expect(c[0]!.images).toEqual(["https://cdn.zivame.com/p/ZI1/1_large.jpg", "https://cdn.zivame.com/p/ZI1/2_large.jpg", "https://cdn.zivame.com/p/ZI1/4_large.jpg"]);
    expect(c[1]!.images).toHaveLength(1);
  });

  it("keeps encoded folder names (no double-encoding) and .JPG case", () => {
    const c = fromImageFolders(`<img src="https://cdn.zivame.com/p/ZI%209%20Red/1_small.JPG">`, "https://www.zivame.com");
    expect(c[0]!.images[0]).toBe("https://cdn.zivame.com/p/ZI%209%20Red/1_large.JPG");
  });
});
