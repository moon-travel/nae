import type { Point3D } from "../types";

export function midpoint(a: Point3D, b: Point3D): Point3D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, visibility: (a.visibility + b.visibility) / 2 };
}

export function distance2D(a: Point3D, b: Point3D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function distance3D(a: Point3D, b: Point3D): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function angle(a: Point3D, b: Point3D, c: Point3D, dimensions: 2 | 3): number | null {
  const ab = [a.x - b.x, a.y - b.y, ...(dimensions === 3 ? [a.z - b.z] : [])];
  const cb = [c.x - b.x, c.y - b.y, ...(dimensions === 3 ? [c.z - b.z] : [])];
  const abLength = Math.hypot(...ab);
  const cbLength = Math.hypot(...cb);
  if (!Number.isFinite(abLength) || !Number.isFinite(cbLength) || abLength === 0 || cbLength === 0) return null;
  const cosine = clamp(ab.reduce((sum, value, index) => sum + value * (cb[index] ?? 0), 0) / (abLength * cbLength), -1, 1);
  return (Math.acos(cosine) * 180) / Math.PI;
}

/** Returns degrees for A-B-C, with B as the vertex. */
export function angle2D(a: Point3D, b: Point3D, c: Point3D): number | null { return angle(a, b, c, 2); }
/** Returns degrees for A-B-C, with B as the vertex. */
export function angle3D(a: Point3D, b: Point3D, c: Point3D): number | null { return angle(a, b, c, 3); }

export function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }

/** Normalizes a signed coordinate delta by a non-zero body reference length. */
export function normalizedOffset(delta: number, referenceLength: number): number {
  return Number.isFinite(delta) && Number.isFinite(referenceLength) && Math.abs(referenceLength) > Number.EPSILON ? delta / referenceLength : 0;
}
