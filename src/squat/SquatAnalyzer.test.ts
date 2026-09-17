import { describe, expect, it } from "vitest";
import { PoseLandmark } from "../pose/landmarks";
import type { Point3D, PoseFrame } from "../types";
import { SquatAnalyzer } from "./SquatAnalyzer";

function frame(timestamp: number, hipY = 0.5): PoseFrame {
  const point = (x: number, y: number): Point3D => ({ x, y, z: 0, visibility: 1 });
  const landmarks = Array.from({ length: 33 }, () => point(0.5, 0.5));
  landmarks[PoseLandmark.LEFT_SHOULDER] = point(0.4, 0.25);
  landmarks[PoseLandmark.RIGHT_SHOULDER] = point(0.6, 0.25);
  landmarks[PoseLandmark.LEFT_HIP] = point(0.42, hipY);
  landmarks[PoseLandmark.RIGHT_HIP] = point(0.58, hipY);
  landmarks[PoseLandmark.LEFT_KNEE] = point(0.42, 0.7);
  landmarks[PoseLandmark.RIGHT_KNEE] = point(0.58, 0.7);
  landmarks[PoseLandmark.LEFT_ANKLE] = point(0.42, 0.9);
  landmarks[PoseLandmark.RIGHT_ANKLE] = point(0.58, 0.9);
  return { timestamp, landmarks, worldLandmarks: landmarks.map((landmark) => ({ ...landmark })) };
}
function invalidFrame(timestamp: number): PoseFrame { const result = frame(timestamp); result.landmarks[PoseLandmark.LEFT_HIP]!.visibility = 0; return result; }

describe("SquatAnalyzer", () => {
  it("calibrates from stable synthetic standing frames and yields measurements", () => {
    const analyzer = new SquatAnalyzer();
    analyzer.startCalibration();
    for (let i = 0; i < 50; i += 1) analyzer.process(frame(i * 40));
    const result = analyzer.process(frame(2_040, 0.62));
    expect(result.calibration.state).toBe("CALIBRATED");
    expect(result.metrics?.depth).toBeGreaterThan(0);
    expect(result.metrics?.estimatedLeftKneeAngle3D).not.toBeNull();
  });
  it("clears usable metrics after an invalid frame", () => {
    const analyzer = new SquatAnalyzer();
    analyzer.startCalibration();
    for (let i = 0; i < 50; i += 1) analyzer.process(frame(i * 40));
    expect(analyzer.process(null, 2_000).metrics).toBeNull();
  });
  it("resetWorkout retains calibration while clearing prior movement state", () => {
    const analyzer = new SquatAnalyzer();
    analyzer.startCalibration();
    for (let i = 0; i < 50; i += 1) analyzer.process(frame(i * 40));
    analyzer.process(frame(2_040, 0.65));
    analyzer.resetWorkout();
    const afterReset = analyzer.process(frame(2_100));
    expect(afterReset.calibration.state).toBe("CALIBRATED");
    expect(afterReset.metrics?.phase).toBe("READY");
    expect(afterReset.metrics?.velocity).toBe(0);
  });
  it("drops a partial movement after a long invalid-pose gap", () => {
    const analyzer = new SquatAnalyzer();
    analyzer.startCalibration();
    for (let i = 0; i < 50; i += 1) analyzer.process(frame(i * 40));
    analyzer.process(frame(2_040, 0.65));
    analyzer.process(invalidFrame(2_100));
    analyzer.process(invalidFrame(3_000));
    // A subsequent standing frame starts from READY rather than completing the old rep.
    const result = analyzer.process(frame(4_000));
    expect(result.metrics?.phase).toBe("READY");
    expect(result.completedRep).toBeUndefined();
  });
  it("resets an interrupted movement when a valid frame returns after a long invalid gap", () => {
    const analyzer = new SquatAnalyzer();
    analyzer.startCalibration();
    for (let i = 0; i < 50; i += 1) analyzer.process(frame(i * 40));
    analyzer.process(frame(2_040, 0.65));
    analyzer.process(invalidFrame(2_100));
    const result = analyzer.process(frame(3_000));
    expect(result.metrics?.phase).toBe("READY");
    expect(result.completedRep).toBeUndefined();
  });
});
