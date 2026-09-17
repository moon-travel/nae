import type { PoseDetection } from './poseTypes';

export interface PoseEngine {
  readonly mode: 'worker' | 'main';
  detect(video: HTMLVideoElement, timestamp: number): Promise<PoseDetection>;
  dispose(): void;
}

export const MODEL_URL = `${import.meta.env.BASE_URL}models/pose_landmarker_full.task`;
export const WASM_URL = `${import.meta.env.BASE_URL}models/mediapipe`;
