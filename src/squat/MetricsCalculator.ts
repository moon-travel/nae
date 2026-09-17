import { PoseLandmark } from "../pose/landmarks";
import type { CalibrationData, Point3D, SquatMetrics } from "../types";
import { angle3D, midpoint, normalizedOffset } from "../utils/geometry";

export interface MetricInputs { timestamp: number; landmarks: Point3D[]; worldLandmarks: Point3D[]; calibration: CalibrationData; phase: SquatMetrics["phase"]; velocity: number; bodyOccupancy: number; quality: number; aspectRatio?: number; }

export function calculateMetrics(input: MetricInputs): SquatMetrics {
  const { landmarks, worldLandmarks, calibration } = input;
  const leftShoulder = landmarks[PoseLandmark.LEFT_SHOULDER]!; const rightShoulder = landmarks[PoseLandmark.RIGHT_SHOULDER]!;
  const leftHip = landmarks[PoseLandmark.LEFT_HIP]!; const rightHip = landmarks[PoseLandmark.RIGHT_HIP]!;
  const leftKnee = landmarks[PoseLandmark.LEFT_KNEE]!; const rightKnee = landmarks[PoseLandmark.RIGHT_KNEE]!;
  const leftAnkle = landmarks[PoseLandmark.LEFT_ANKLE]!; const rightAnkle = landmarks[PoseLandmark.RIGHT_ANKLE]!;
  const shoulderCenter = midpoint(leftShoulder, rightShoulder); const hipCenter = midpoint(leftHip, rightHip); const ankleCenter = midpoint(leftAnkle, rightAnkle);
  const torsoLean = (Math.atan2((shoulderCenter.x - hipCenter.x) * (input.aspectRatio ?? 1), hipCenter.y - shoulderCenter.y) * 180) / Math.PI - calibration.baselineTorsoLean;
  const depth = normalizedOffset(hipCenter.y - calibration.standingHipY, calibration.bodyHeight);
  const hipShift = normalizedOffset(hipCenter.x - ankleCenter.x - calibration.baselineHipShift, calibration.shoulderWidth);
  const leftKneeOffset = normalizedOffset(leftKnee.x - leftAnkle.x, calibration.shoulderWidth);
  const rightKneeOffset = normalizedOffset(rightKnee.x - rightAnkle.x, calibration.shoulderWidth);
  const world = (index: number): Point3D | undefined => worldLandmarks[index];
  const leftAngle = world(PoseLandmark.LEFT_HIP) && world(PoseLandmark.LEFT_KNEE) && world(PoseLandmark.LEFT_ANKLE) ? angle3D(world(PoseLandmark.LEFT_HIP)!, world(PoseLandmark.LEFT_KNEE)!, world(PoseLandmark.LEFT_ANKLE)!) : null;
  const rightAngle = world(PoseLandmark.RIGHT_HIP) && world(PoseLandmark.RIGHT_KNEE) && world(PoseLandmark.RIGHT_ANKLE) ? angle3D(world(PoseLandmark.RIGHT_HIP)!, world(PoseLandmark.RIGHT_KNEE)!, world(PoseLandmark.RIGHT_ANKLE)!) : null;
  return { timestamp: input.timestamp, phase: input.phase, depth, velocity: input.velocity, torsoLean, hipShift, leftKneeOffset, rightKneeOffset, kneeTrackingAsymmetry: leftKneeOffset - rightKneeOffset, estimatedLeftKneeAngle3D: leftAngle, estimatedRightKneeAngle3D: rightAngle, bodyOccupancy: input.bodyOccupancy, quality: input.quality };
}
