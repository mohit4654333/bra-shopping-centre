import { describe, expect, it } from "vitest";
import { ratingSummary, reviewSchema, timeAgo } from "./reviews";

describe("reviews", () => {
  it("sample reviews never count toward the rating", () => {
    const s = ratingSummary([
      { rating: 5, is_sample: true, status: "approved" },
      { rating: 3, is_sample: false, status: "approved" },
    ]);
    expect(s).toEqual({ average: 3, count: 1 });
  });
  it("pending reviews are not counted", () => {
    expect(ratingSummary([{ rating: 5, is_sample: false, status: "pending" }])).toEqual({ average: 0, count: 0 });
  });
  it("rating must be 1-5 stars", () => {
    expect(reviewSchema.safeParse({ customer_name: "Priya", rating: 0, body: "Nice" }).success).toBe(false);
    expect(reviewSchema.safeParse({ customer_name: "Priya", rating: 5, body: "Nice" }).success).toBe(true);
  });
  it("shows honest elapsed time", () => {
    const now = Date.parse("2026-01-01T12:00:00Z");
    expect(timeAgo("2026-01-01T11:48:00Z", now)).toBe("12 min pehle");
  });
});
