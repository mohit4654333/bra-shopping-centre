import { z } from "zod";
import { cleanBrandText } from "./brandwipe";
import { STORE_BRAND } from "./types";

export type Review = {
  id: string;
  product_id: string;
  customer_name: string;
  city: string;
  rating: number;
  body: string;
  photos: string[];
  is_sample: boolean;
  verified: boolean;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

// Review text and city pass through the competitor brand wiper before validation and saving.
const wipe = (v: unknown) => (typeof v === "string" ? cleanBrandText(v, STORE_BRAND) : v);

export const reviewSchema = z.object({
  customer_name: z.string().trim().min(2, "Naam likhein").max(60),
  city: z.preprocess(wipe, z.string().trim().max(60).default("")),
  rating: z.number().int().min(1, "Star rating chunein").max(5),
  body: z.preprocess(wipe, z.string().trim().min(3, "Review likhein").max(1000)),
});

export const MAX_REVIEW_PHOTOS = 3;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Average and count use real customer reviews only — sample reviews never affect the rating. */
export function ratingSummary(reviews: Pick<Review, "rating" | "is_sample" | "status">[]) {
  const real = reviews.filter((r) => !r.is_sample && r.status === "approved");
  if (!real.length) return { average: 0, count: 0 };
  const avg = real.reduce((s, r) => s + r.rating, 0) / real.length;
  return { average: Math.round(avg * 10) / 10, count: real.length };
}

export function timeAgo(iso: string, now = Date.now()): string {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (m < 1) return "abhi";
  if (m < 60) return `${m} min pehle`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ghante pehle`;
  return `${Math.round(h / 24)} din pehle`;
}

export function reviewPhotoUrl(path: string) {
  return `/api/public/review-img?p=${encodeURIComponent(path)}`;
}
