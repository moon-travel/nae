import { describe, expect, it } from "vitest";
import { EmaFilter } from "./EmaFilter";
describe("EmaFilter", () => {
  it("uses the first value then exponentially smooths", () => { const filter = new EmaFilter(0.3); expect(filter.update(10)).toBe(10); expect(filter.update(0)).toBeCloseTo(7); filter.reset(); expect(filter.update(2)).toBe(2); });
});
