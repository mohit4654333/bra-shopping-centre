/** Ask the shop's photo server for its full-size original instead of a small preview. */
export function hdUrl(url: string): string {
  // Zivame: .../1_large.jpg (460px) -> .../1.jpg (1000x1500 original)
  if (/cdn\.zivame\.com/i.test(url)) return url.replace(/\/(\d+)_(large|medium|small|thumb)(\.(?:jpe?g|png|webp))/i, "/$1$3");
  return url;
}

/** Route outside photos through our relay so hot-link protected images still show. */
export function imgSrc(url?: string | null): string {
  if (!url) return "";
  if (url.startsWith("/") || url.startsWith("data:") || url.startsWith("blob:")) return url;
  return `/api/public/img?u=${encodeURIComponent(hdUrl(url))}`;
}
