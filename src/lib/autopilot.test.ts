import { describe, expect, it } from "vitest";
import { autopilotNext } from "./autoqueue";
describe("autopilotNext", () => {
  it("stays on the current channel while it has products", () => expect(autopilotNext(["a", "b"], 0, {})).toBe(0));
  it("switches to the next channel after two empty scans", () => expect(autopilotNext(["a", "b"], 0, { a: 2 })).toBe(1));
  it("stops when every channel is empty", () => expect(autopilotNext(["a", "b"], 0, { a: 2, b: 2 })).toBe(-1));
});

import { pilotStep, PILOT_BATCH } from "./autoqueue";
describe("pilotStep (background Auto-Pilot)", () => {
  it("imports the next waiting product first", () =>
    expect(pilotStep({ pending_urls: ["u1", "u2"], dry_scans: 0, last_scanned_page: 4 })).toEqual({ kind: "import", url: "u1" }));
  it("scans from the last page when nothing is waiting", () =>
    expect(pilotStep({ pending_urls: [], dry_scans: 1, last_scanned_page: 4 })).toEqual({ kind: "scan", fromPage: 4 }));
  it("never stops: after 3 empty scans it restarts from page 1", () =>
    expect(pilotStep({ pending_urls: [], dry_scans: 3, last_scanned_page: 9 })).toEqual({ kind: "scan", fromPage: 0 }));
  it("batches 60 products per scan", () => expect(PILOT_BATCH).toBe(60));
});
