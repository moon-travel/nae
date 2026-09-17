import type { Point3D } from "../types";

export class EmaFilter {
  private previous: number | null = null;
  public constructor(private readonly alpha: number) {}
  update(value: number): number {
    if (!Number.isFinite(value)) return this.previous ?? 0;
    this.previous = this.previous === null ? value : this.alpha * value + (1 - this.alpha) * this.previous;
    return this.previous;
  }
  reset(): void { this.previous = null; }
}

export class LandmarkEmaFilter {
  private previous: Point3D[] | null = null;
  public constructor(private readonly alpha: number) {}
  update(points: Point3D[]): Point3D[] {
    const current = points.map((point) => ({ ...point }));
    if (!this.previous || this.previous.length !== current.length) {
      this.previous = current;
      return current;
    }
    this.previous = current.map((point, index) => {
      const prior = this.previous?.[index] ?? point;
      return {
        x: this.alpha * point.x + (1 - this.alpha) * prior.x,
        y: this.alpha * point.y + (1 - this.alpha) * prior.y,
        z: this.alpha * point.z + (1 - this.alpha) * prior.z,
        visibility: this.alpha * point.visibility + (1 - this.alpha) * prior.visibility,
      };
    });
    return this.previous.map((point) => ({ ...point }));
  }
  reset(): void { this.previous = null; }
}
