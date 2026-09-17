import { describe, expect, it } from "vitest";
import type { Point3D } from "../types";
import { angle2D, angle3D, distance2D, distance3D, midpoint, normalizedOffset } from "./geometry";

const p = (x: number, y: number, z = 0): Point3D => ({ x, y, z, visibility: 1 });
describe("geometry", () => {
  it("calculates midpoint and distances", () => {
    expect(midpoint(p(0, 0), p(2, 4, 6))).toMatchObject({ x: 1, y: 2, z: 3 });
    expect(distance2D(p(0, 0), p(3, 4))).toBe(5);
    expect(distance3D(p(0, 0, 0), p(1, 2, 2))).toBe(3);
  });
  it("calculates vertex angles and handles zero vectors", () => {
    expect(angle2D(p(1, 0), p(0, 0), p(0, 1))).toBeCloseTo(90);
    expect(angle3D(p(1, 0, 0), p(0, 0, 0), p(0, 0, 1))).toBeCloseTo(90);
    expect(angle2D(p(0, 0), p(0, 0), p(1, 1))).toBeNull();
  });
  it("normalizes safely", () => { expect(normalizedOffset(3, 6)).toBe(0.5); expect(normalizedOffset(3, 0)).toBe(0); });
});
